import { validateDynamicQrToken } from "./index.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lookup } from "node:dns/promises";
import type { PrismaClient } from "@prisma/client";
import { parseOrganizationId } from "../../common/organization-id.js";

/** Para registrar InventoryMovement en Nest tras el commit local (misma BD, sin doble stock). */
export type DisisNestSyncContext = {
  organizationId: number;
  productId: number;
  quantity: number;
  disisTransactionId: number;
};

/** Logs antiguos solo tenían companyId (string); se resuelve organizationId al sincronizar. */
type OfflineDispatchRecord = {
  id: string;
  organizationId?: number;
  companyId: string;
  nationalId: string;
  amount: number;
  productId?: string;
  quantity?: number;
  idempotencyKey?: string;
  createdAt: string;
  isSynced: boolean;
  syncAttempts: number;
  syncedAt?: string;
  lastError?: string;
};

type ClientLifeCard = {
  clientId: string;
  companyId: string;
  nationalId: string;
  name: string;
  balance: number;
  consumptionHistory: {
    totalConsumed: number;
    totalOperations: number;
    lastConsumptions: Array<{
      id: string;
      amount: number;
      status: string;
      createdAt: string;
    }>;
  };
  canConsume: boolean;
  requiresPin: boolean;
};

function parseOptionalProductId(productId: string | undefined): number | undefined {
  if (productId == null || productId === "") return undefined;
  const n = Number.parseInt(productId, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export class DispatchController {
  private readonly offlineLogPath = path.resolve(process.cwd(), "offline_logs.json");

  constructor(private readonly prisma: PrismaClient) {}

  async scanQR(input: { companyId: string; nationalId: string; token: string }): Promise<ClientLifeCard> {
    const organizationId = parseOrganizationId(input.companyId);
    const client = await this.prisma.disisClient.findFirst({
      where: {
        organizationId,
        nationalId: input.nationalId.trim(),
      },
      include: {
        transactions: {
          where: {
            organizationId,
            type: "CONSUMPTION",
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
    });

    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    validateDynamicQrToken(input.token, client.qrSecret);

    return this.toLifeCard(client);
  }

  async manualSearch(input: { companyId: string; nationalId: string; pin?: string }): Promise<ClientLifeCard> {
    const organizationId = parseOrganizationId(input.companyId);
    const client = await this.prisma.disisClient.findFirst({
      where: {
        organizationId,
        nationalId: input.nationalId.trim(),
      },
      include: {
        transactions: {
          where: {
            organizationId,
            type: "CONSUMPTION",
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
    });

    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    const hasPin = typeof client.pin === "string" && client.pin.length > 0;
    if (hasPin && !input.pin) {
      throw new Error("PIN_REQUIRED");
    }
    if (hasPin && input.pin !== client.pin) {
      throw new Error("PIN_INVALID");
    }

    return this.toLifeCard(client);
  }

  async confirmDispatch(input: {
    companyId: string;
    nationalId: string;
    amount: number;
    productId?: string;
    quantity?: number;
    idempotencyKey?: string;
  }): Promise<{
    clientId: string;
    companyId: string;
    previousBalance: number;
    newBalance: number;
    transactionId: string;
    isSynced: boolean;
    queuedOffline?: boolean;
    nestSyncContext?: DisisNestSyncContext;
  }> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("INVALID_AMOUNT");
    }

    const organizationId = parseOrganizationId(input.companyId);

    try {
      return await this.executeCloudDispatch({
        organizationId,
        nationalId: input.nationalId.trim(),
        amount: input.amount,
        productId: input.productId,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey,
        companyIdOut: input.companyId,
      });
    } catch (error) {
      if (!this.isDatabaseConnectionError(error)) {
        throw error;
      }

      const offlineRecord = await this.enqueueOfflineDispatch(
        {
          organizationId,
          companyId: input.companyId,
          nationalId: input.nationalId.trim(),
          amount: input.amount,
          productId: input.productId,
          quantity: input.quantity,
          idempotencyKey: input.idempotencyKey,
        },
        error,
      );
      return {
        clientId: `offline:${offlineRecord.nationalId}`,
        companyId: offlineRecord.companyId,
        previousBalance: 0,
        newBalance: 0,
        transactionId: offlineRecord.id,
        isSynced: false,
        queuedOffline: true,
      };
    }
  }

  async syncOfflineLogsToCloud(): Promise<{
    total: number;
    synced: number;
    failed: number;
  }> {
    const hasInternet = await this.hasInternetConnection();
    if (!hasInternet) {
      return { total: 0, synced: 0, failed: 0 };
    }

    const logs = await this.readOfflineLogs();
    const pending = logs.filter((item) => !item.isSynced);
    if (pending.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        const organizationId =
          typeof item.organizationId === "number" && item.organizationId > 0
            ? item.organizationId
            : parseOrganizationId(item.companyId);
        await this.executeCloudDispatch({
          organizationId,
          nationalId: item.nationalId,
          amount: item.amount,
          productId: item.productId,
          quantity: item.quantity,
          idempotencyKey: item.idempotencyKey,
          companyIdOut: item.companyId,
        });
        item.isSynced = true;
        item.syncedAt = new Date().toISOString();
        item.lastError = undefined;
        synced += 1;
      } catch (error) {
        failed += 1;
        item.syncAttempts += 1;
        item.lastError = error instanceof Error ? error.message : "SYNC_ERROR";
      }
    }

    await this.writeOfflineLogs(logs);
    return { total: pending.length, synced, failed };
  }

  startOfflineSyncJob(): NodeJS.Timeout {
    return setInterval(() => {
      this.syncOfflineLogsToCloud().catch(() => {});
    }, 5 * 60 * 1000);
  }

  private async executeCloudDispatch(input: {
    organizationId: number;
    nationalId: string;
    amount: number;
    productId?: string;
    quantity?: number;
    idempotencyKey?: string;
    companyIdOut: string;
  }): Promise<{
    clientId: string;
    companyId: string;
    previousBalance: number;
    newBalance: number;
    transactionId: string;
    isSynced: boolean;
    nestSyncContext?: DisisNestSyncContext;
  }> {
    return this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existingTx = await tx.disisTransaction.findFirst({
          where: {
            organizationId: input.organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        if (existingTx) {
          const existingClient = await tx.disisClient.findUnique({
            where: { id: existingTx.clientId },
          });
          return {
            clientId: String(existingTx.clientId),
            companyId: input.companyIdOut,
            previousBalance: Number(existingClient?.balance ?? 0),
            newBalance: Number(existingClient?.balance ?? 0),
            transactionId: String(existingTx.id),
            isSynced: true,
          };
        }
      }

      const client = await tx.disisClient.findUnique({
        where: {
          organizationId_nationalId: {
            organizationId: input.organizationId,
            nationalId: input.nationalId,
          },
        },
      });

      if (!client) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      const productIdInt = parseOptionalProductId(input.productId);
      const qtyInt =
        input.quantity != null && Number.isFinite(input.quantity) && input.quantity > 0
          ? Math.max(1, Math.floor(input.quantity))
          : undefined;

      if (productIdInt != null && qtyInt != null) {
        const product = await tx.product.findFirst({
          where: { id: productIdInt, organizationId: input.organizationId },
        });
        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }
        if (product.stock < qtyInt) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const debitResult = await tx.disisClient.updateMany({
        where: {
          id: client.id,
          organizationId: input.organizationId,
          balance: { gte: input.amount },
        },
        data: {
          balance: { decrement: input.amount },
        },
      });
      if (debitResult.count === 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      if (productIdInt != null && qtyInt != null) {
        const stockResult = await tx.product.updateMany({
          where: {
            id: productIdInt,
            organizationId: input.organizationId,
            stock: { gte: qtyInt },
          },
          data: { stock: { decrement: qtyInt } },
        });
        if (stockResult.count === 0) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const updatedClient = await tx.disisClient.findUnique({
        where: { id: client.id },
      });
      if (!updatedClient) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      const inventorySyncStatus =
        productIdInt != null && qtyInt != null ? ("PENDING" as const) : ("SYNCED" as const);

      const transaction = await tx.disisTransaction.create({
        data: {
          organizationId: input.organizationId,
          clientId: updatedClient.id,
          type: "CONSUMPTION",
          status: "PENDING",
          amount: input.amount,
          productId: productIdInt,
          quantity: qtyInt ?? (input.quantity != null ? input.quantity : undefined),
          idempotencyKey: input.idempotencyKey,
          inventorySyncStatus,
        },
      });

      return {
        clientId: String(updatedClient.id),
        companyId: input.companyIdOut,
        previousBalance: Number(client.balance),
        newBalance: Number(updatedClient.balance),
        transactionId: String(transaction.id),
        isSynced: true,
        nestSyncContext:
          productIdInt != null && qtyInt != null
            ? {
                organizationId: input.organizationId,
                productId: productIdInt,
                quantity: qtyInt,
                disisTransactionId: transaction.id,
              }
            : undefined,
      };
    });
  }

  private async enqueueOfflineDispatch(
    input: {
      organizationId: number;
      companyId: string;
      nationalId: string;
      amount: number;
      productId?: string;
      quantity?: number;
      idempotencyKey?: string;
    },
    error: unknown,
  ): Promise<OfflineDispatchRecord> {
    const logs = await this.readOfflineLogs();
    if (input.idempotencyKey) {
      const existing = logs.find(
        (item) =>
          !item.isSynced &&
          item.companyId === input.companyId &&
          item.idempotencyKey === input.idempotencyKey,
      );
      if (existing) {
        return existing;
      }
    }

    const record: OfflineDispatchRecord = {
      id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      organizationId: input.organizationId,
      companyId: input.companyId,
      nationalId: input.nationalId,
      amount: Number(input.amount.toFixed(2)),
      productId: input.productId,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
      isSynced: false,
      syncAttempts: 0,
      lastError: error instanceof Error ? error.message : "DB_CONNECTION_ERROR",
    };

    logs.push(record);
    await this.writeOfflineLogs(logs);
    return record;
  }

  private async readOfflineLogs(): Promise<OfflineDispatchRecord[]> {
    try {
      const content = await readFile(this.offlineLogPath, "utf8");
      const parsed = JSON.parse(content) as OfflineDispatchRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeOfflineLogs(records: OfflineDispatchRecord[]): Promise<void> {
    await mkdir(path.dirname(this.offlineLogPath), { recursive: true });
    await writeFile(this.offlineLogPath, JSON.stringify(records, null, 2), "utf8");
  }

  private isDatabaseConnectionError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return (
      message.includes("database") ||
      message.includes("connect") ||
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("prisma")
    );
  }

  private async hasInternetConnection(): Promise<boolean> {
    try {
      await lookup("one.one.one.one");
      return true;
    } catch {
      return false;
    }
  }

  private toLifeCard(client: {
    id: number;
    organizationId: number;
    nationalId: string;
    name: string;
    balance: { toString(): string } | number;
    pin: string | null;
    transactions: Array<{
      id: number;
      amount: { toString(): string } | number;
      status: string;
      createdAt: Date;
    }>;
  }): ClientLifeCard {
    const balance = typeof client.balance === "number" ? client.balance : Number(client.balance.toString());
    const totalConsumed = client.transactions.reduce((acc, item) => {
      const a = typeof item.amount === "number" ? item.amount : Number(item.amount.toString());
      return acc + a;
    }, 0);
    return {
      clientId: String(client.id),
      companyId: String(client.organizationId),
      nationalId: client.nationalId,
      name: client.name,
      balance,
      consumptionHistory: {
        totalConsumed,
        totalOperations: client.transactions.length,
        lastConsumptions: client.transactions.map((tx) => ({
          id: String(tx.id),
          amount: typeof tx.amount === "number" ? tx.amount : Number(tx.amount.toString()),
          status: tx.status,
          createdAt: tx.createdAt.toISOString(),
        })),
      },
      canConsume: balance > 0,
      requiresPin: Boolean(client.pin),
    };
  }
}
