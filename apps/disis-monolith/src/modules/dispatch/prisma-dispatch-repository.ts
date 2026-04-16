import type { PrismaClient } from "@prisma/client";
import type { ClientRecord, DispatchRepository, TransactionRecord } from "./index.js";
import { parseOrganizationId } from "../../common/organization-id.js";

export type ConsumeDispatchAtomicallyResult = {
  transaction: TransactionRecord;
  remainingBalance: number;
  nestSyncContext?: {
    organizationId: number;
    productId: number;
    quantity: number;
    disisTransactionId: number;
  };
};

function toClientRecord(row: {
  id: number;
  organizationId: number;
  nationalId: string;
  name: string;
  balance: { toString(): string } | number;
  qrSecret: string;
}): ClientRecord {
  return {
    id: String(row.id),
    companyId: String(row.organizationId),
    nationalId: row.nationalId,
    name: row.name,
    balance: typeof row.balance === "number" ? row.balance : Number(row.balance.toString()),
    qrSecret: row.qrSecret,
  };
}

function parseOptionalProductId(productId: string | undefined): number | undefined {
  if (productId == null || productId === "") return undefined;
  const n = Number.parseInt(productId, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function quantityToUnits(quantity: number | undefined): number | undefined {
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) return undefined;
  return Math.max(1, Math.floor(quantity));
}

function mapDisisTxToRecord(
  tx: {
    id: number;
    organizationId: number;
    clientId: number;
    productId: number | null;
    amount: { toString(): string } | number;
    quantity: { toString(): string } | number | null;
    inventorySyncStatus: string;
    disisInventoryMovementId: string | null;
    createdAt: Date;
  },
  productIdInput: string | undefined,
): TransactionRecord {
  return {
    id: String(tx.id),
    companyId: String(tx.organizationId),
    clientId: String(tx.clientId),
    type: "CONSUMPTION",
    status: "PENDING",
    amount: typeof tx.amount === "number" ? tx.amount : Number(tx.amount.toString()),
    quantity: tx.quantity != null ? Number(tx.quantity.toString()) : undefined,
    productId: productIdInput,
    inventorySyncStatus: tx.inventorySyncStatus as TransactionRecord["inventorySyncStatus"],
    disisInventoryMovementId: tx.disisInventoryMovementId ?? undefined,
    createdAt: tx.createdAt.toISOString(),
  };
}

/**
 * Un solo $transaction: cartera DISIS + movimiento + stock del producto (tabla `products` del SaaS).
 * Evita cartera descontada sin stock (o al revés) y no duplica descuentos vía HTTP frente a Nest.
 */
export async function consumeDispatchAtomically(
  prisma: PrismaClient,
  params: {
    companyId: string;
    clientId: string;
    amount: number;
    quantity?: number;
    productId?: string;
  },
): Promise<ConsumeDispatchAtomicallyResult> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const organizationId = parseOrganizationId(params.companyId);
  const clientId = Number.parseInt(params.clientId, 10);
  if (!Number.isFinite(clientId) || clientId < 1) {
    throw new Error("INVALID_CLIENT_ID");
  }

  const productIdNum = parseOptionalProductId(params.productId);
  const qtyInt = quantityToUnits(params.quantity);

  return prisma.$transaction(async (tx) => {
    const client = await tx.disisClient.findFirst({
      where: { id: clientId, organizationId },
    });
    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    if (productIdNum != null && qtyInt != null) {
      const product = await tx.product.findFirst({
        where: { id: productIdNum, organizationId },
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
        organizationId,
        balance: { gte: params.amount },
      },
      data: { balance: { decrement: params.amount } },
    });
    if (debitResult.count === 0) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    if (productIdNum != null && qtyInt != null) {
      const stockResult = await tx.product.updateMany({
        where: {
          id: productIdNum,
          organizationId,
          stock: { gte: qtyInt },
        },
        data: { stock: { decrement: qtyInt } },
      });
      if (stockResult.count === 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }
    }

    const updatedClient = await tx.disisClient.findUnique({ where: { id: client.id } });
    if (!updatedClient) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    /** Con producto: PENDING hasta que Nest registre movimiento/gasto; sin producto: no aplica inventario Nest → SYNCED. */
    const inventorySyncStatus =
      productIdNum != null && qtyInt != null ? ("PENDING" as const) : ("SYNCED" as const);

    const row = await tx.disisTransaction.create({
      data: {
        organizationId,
        clientId: updatedClient.id,
        productId: productIdNum ?? undefined,
        type: "CONSUMPTION",
        status: "PENDING",
        amount: params.amount,
        quantity: qtyInt ?? undefined,
        inventorySyncStatus,
      },
    });

    return {
      transaction: mapDisisTxToRecord(row, params.productId),
      remainingBalance: Number(updatedClient.balance),
      nestSyncContext:
        productIdNum != null && qtyInt != null
          ? {
              organizationId,
              productId: productIdNum,
              quantity: qtyInt,
              disisTransactionId: row.id,
            }
          : undefined,
    };
  });
}

export function createPrismaDispatchRepository(prisma: PrismaClient): DispatchRepository {
  return {
    async findClientByNationalId(companyId, nationalId) {
      const organizationId = parseOrganizationId(companyId);
      const row = await prisma.disisClient.findFirst({
        where: { organizationId, nationalId: nationalId.trim() },
      });
      return row ? toClientRecord(row) : null;
    },

    async findClientById(companyId, clientId) {
      const organizationId = parseOrganizationId(companyId);
      const id = Number.parseInt(clientId, 10);
      if (!Number.isFinite(id) || id < 1) return null;
      const row = await prisma.disisClient.findFirst({
        where: { id, organizationId },
      });
      return row ? toClientRecord(row) : null;
    },

    async updateClientBalance(clientId, nextBalance) {
      const id = Number.parseInt(clientId, 10);
      if (!Number.isFinite(id) || id < 1) return;
      await prisma.disisClient.update({
        where: { id },
        data: { balance: nextBalance },
      });
    },

    async createPendingConsumption(input) {
      const organizationId = parseOrganizationId(input.companyId);
      const clientId = Number.parseInt(input.clientId, 10);
      if (!Number.isFinite(clientId) || clientId < 1) {
        throw new Error("INVALID_CLIENT_ID");
      }
      const productId = parseOptionalProductId(input.productId);

      const tx = await prisma.disisTransaction.create({
        data: {
          organizationId,
          clientId,
          productId: productId ?? undefined,
          type: "CONSUMPTION",
          status: "PENDING",
          amount: input.amount,
          quantity: input.quantity != null ? input.quantity : undefined,
          inventorySyncStatus: input.inventorySyncStatus ?? "PENDING",
          disisInventoryMovementId: input.disisInventoryMovementId,
        },
      });

      return mapDisisTxToRecord(tx, input.productId);
    },
  };
}
