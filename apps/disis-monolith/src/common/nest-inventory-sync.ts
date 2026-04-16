import type { PrismaClient } from "@prisma/client";

export type NestInventoryAuditResult = {
  synced: boolean;
  movementId?: string;
  error?: string;
};

type NestSyncPayload = {
  organizationId: number;
  productId: number;
  quantity: number;
  disisTransactionId: number;
  authToken: string | undefined;
};

/**
 * Tras descontar stock en `products` dentro del monolito, registra el mismo consumo en Nest:
 * InventoryMovement + gasto (categoría autoconsumo) + activity log, sin volver a tocar stock.
 */
export async function registerNestMovementAfterDisisDispatch(
  prisma: PrismaClient,
  params: NestSyncPayload,
): Promise<NestInventoryAuditResult> {
  const baseUrl = process.env.DISIS_SERVER_URL?.replace(/\/$/, "");
  const sharedSecret = process.env.DISIS_DISPATCH_SHARED_SECRET?.trim();
  const token = params.authToken?.trim();

  if (!baseUrl || !sharedSecret || !token) {
    return { synced: false, error: "NEST_SYNC_SKIPPED" };
  }

  const url = `${baseUrl}/inventory/movements`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-tenant-id": String(params.organizationId),
        "x-disis-dispatch-secret": sharedSecret,
      },
      body: JSON.stringify({
        type: "USO_TALLER",
        quantity: params.quantity,
        productId: params.productId,
        reason: `Despacho DISIS (disis_transactions.id=${params.disisTransactionId})`,
        consumptionReason: "USO_OPERATIVO",
        stockAlreadyAdjusted: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      await prisma.disisTransaction.update({
        where: { id: params.disisTransactionId },
        data: { inventorySyncStatus: "FAILED" },
      });
      return { synced: false, error: errText || `HTTP_${res.status}` };
    }

    const data = (await res.json()) as { movement?: { id?: number } };
    const movementId = data.movement?.id != null ? String(data.movement.id) : undefined;

    await prisma.disisTransaction.update({
      where: { id: params.disisTransactionId },
      data: {
        inventorySyncStatus: "SYNCED",
        disisInventoryMovementId: movementId,
      },
    });

    return { synced: true, movementId };
  } catch (e) {
    await prisma.disisTransaction
      .update({
        where: { id: params.disisTransactionId },
        data: { inventorySyncStatus: "FAILED" },
      })
      .catch(() => {});
    return { synced: false, error: e instanceof Error ? e.message : "FETCH_ERROR" };
  }
}
