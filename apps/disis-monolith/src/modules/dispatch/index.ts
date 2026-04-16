import { verifyDynamicToken } from "../../common/security.service.js";

export type DispatchRole = "DISPATCHER" | "PUNTO_RETIRO";

export type ClientRecord = {
  id: string;
  companyId: string;
  nationalId: string;
  name: string;
  balance: number;
  qrSecret: string;
};

export type TransactionRecord = {
  id: string;
  companyId: string;
  clientId: string;
  type: "CONSUMPTION";
  status: "PENDING";
  amount: number;
  quantity?: number;
  productId?: string;
  inventorySyncStatus: "PENDING" | "SYNCED" | "FAILED";
  disisInventoryMovementId?: string;
  createdAt: string;
};

export type DispatchRepository = {
  findClientByNationalId(companyId: string, nationalId: string): Promise<ClientRecord | null>;
  findClientById(companyId: string, clientId: string): Promise<ClientRecord | null>;
  updateClientBalance(clientId: string, nextBalance: number): Promise<void>;
  createPendingConsumption(input: {
    companyId: string;
    clientId: string;
    amount: number;
    quantity?: number;
    productId?: string;
    inventorySyncStatus?: "PENDING" | "SYNCED" | "FAILED";
    disisInventoryMovementId?: string;
  }): Promise<TransactionRecord>;
};

export type InventorySyncResult = {
  status: "SYNCED" | "FAILED";
  disisInventoryMovementId?: string;
  error?: string;
};

export function validateDynamicQrToken(token: string, qrSecret: string): { valid: true } {
  const cleanToken = token.trim();
  if (!/^\d{6}$/.test(cleanToken)) {
    throw new Error("QR_TOKEN_INVALID_FORMAT");
  }

  const isValid = verifyDynamicToken(cleanToken, qrSecret);
  if (!isValid) {
    throw new Error("QR_TOKEN_INVALID_OR_EXPIRED");
  }

  return { valid: true };
}

export async function searchClientManually(params: {
  role: DispatchRole;
  companyId: string;
  nationalId: string;
  repo: DispatchRepository;
}): Promise<ClientRecord> {
  if (params.role !== "DISPATCHER" && params.role !== "PUNTO_RETIRO") {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  const client = await params.repo.findClientByNationalId(params.companyId, params.nationalId);
  if (!client) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  return client;
}

/**
 * Flujo legacy (no atómico): actualiza saldo, opcionalmente sincroniza inventario por HTTP y crea fila.
 * En producción el monolito usa `consumeDispatchAtomically` (misma BD, un solo `$transaction`).
 * @deprecated Para nuevas integraciones usar `consumeDispatchAtomically` desde `prisma-dispatch-repository.js`.
 */
export async function dispatchConsumption(params: {
  companyId: string;
  clientId: string;
  amount: number;
  quantity?: number;
  productId?: string;
  repo: DispatchRepository;
  syncInventory?: (input: {
    companyId: string;
    clientId: string;
    productId: string;
    quantity: number;
  }) => Promise<InventorySyncResult>;
}): Promise<{ transaction: TransactionRecord; remainingBalance: number }> {
  if (params.amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const client = await params.repo.findClientById(params.companyId, params.clientId);
  if (!client) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  if (client.balance < params.amount) {
    throw new Error("INSUFFICIENT_BALANCE");
  }

  const remainingBalance = Number((client.balance - params.amount).toFixed(2));
  await params.repo.updateClientBalance(client.id, remainingBalance);

  let inventorySyncStatus: "PENDING" | "SYNCED" | "FAILED" = "PENDING";
  let disisInventoryMovementId: string | undefined;
  if (params.productId && params.quantity && params.quantity > 0 && params.syncInventory) {
    const syncResult = await params.syncInventory({
      companyId: params.companyId,
      clientId: client.id,
      productId: params.productId,
      quantity: params.quantity,
    });
    inventorySyncStatus = syncResult.status;
    disisInventoryMovementId = syncResult.disisInventoryMovementId;
  }

  const transaction = await params.repo.createPendingConsumption({
    companyId: params.companyId,
    clientId: client.id,
    amount: params.amount,
    quantity: params.quantity,
    productId: params.productId,
    inventorySyncStatus,
    disisInventoryMovementId,
  });

  return { transaction, remainingBalance };
}
