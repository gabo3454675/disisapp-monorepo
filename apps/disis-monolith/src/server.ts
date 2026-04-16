import http from "node:http";
import { PrismaClient } from "@prisma/client";
import { searchClientManually, validateDynamicQrToken } from "./modules/dispatch/index.js";
import { generateClientQrSecret } from "./common/security.service.js";
import { DispatchController } from "./modules/dispatch/dispatch.controller.js";
import {
  consumeDispatchAtomically,
  createPrismaDispatchRepository,
} from "./modules/dispatch/prisma-dispatch-repository.js";
import { parseOrganizationId, parseUserId } from "./common/organization-id.js";
import { registerNestMovementAfterDisisDispatch } from "./common/nest-inventory-sync.js";

const port = Number(process.env.PORT ?? 4100);
const prisma = new PrismaClient();
const repo = createPrismaDispatchRepository(prisma);
const dispatchController = new DispatchController(prisma);
let offlineSyncTimer: NodeJS.Timeout | null = null;
offlineSyncTimer = dispatchController.startOfflineSyncJob();
dispatchController.syncOfflineLogsToCloud().catch(() => {});

/** Sesión en memoria: usuario (id numérico, mismo User que Nest) → organización seleccionada */
const adminSessions = new Map<string, { selectedOrganizationId: number }>();

async function loadOrganizationsForAdmin(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  if (!user) return null;
  if (user.isSuperAdmin) {
    return prisma.organization.findMany({
      orderBy: { id: "asc" },
      select: { id: true, nombre: true, slug: true },
    });
  }
  const members = await prisma.member.findMany({
    where: { userId, status: "ACTIVE" },
    include: { organization: { select: { id: true, nombre: true, slug: true } } },
  });
  return members.map((m) => m.organization);
}

async function userHasOrganizationAccess(userId: number, organizationId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const m = await prisma.member.findFirst({
    where: { userId, organizationId, status: "ACTIVE" },
  });
  return Boolean(m);
}

async function requireAdminContext(req: http.IncomingMessage): Promise<{ userId: number; organizationId: string }> {
  const userId = parseUserId(String(req.headers["x-admin-id"] ?? ""));
  const headerOrg = String(req.headers["x-company-id"] ?? "").trim();
  const session = adminSessions.get(String(userId));
  let organizationId: number | undefined;
  if (headerOrg) {
    organizationId = parseOrganizationId(headerOrg);
  } else if (session?.selectedOrganizationId != null) {
    organizationId = session.selectedOrganizationId;
  }
  if (organizationId == null) {
    throw new Error("ADMIN_ORGANIZATION_REQUIRED");
  }
  const ok = await userHasOrganizationAccess(userId, organizationId);
  if (!ok) {
    throw new Error("ADMIN_FORBIDDEN_COMPANY");
  }
  return { userId, organizationId: String(organizationId) };
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = req.url ? new URL(req.url, "http://localhost").pathname : "";

    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, {
        service: "disis-monolith",
        status: "ok",
        modules: ["auth", "billing", "dispatch", "clients"],
        dataSource: "postgresql",
      });
    }

    if (req.method === "GET" && pathname === "/api/v1/admin/companies") {
      const adminHeader = String(req.headers["x-admin-id"] ?? "");
      if (!adminHeader) {
        return sendJson(res, 401, { error: "ADMIN_UNAUTHORIZED" });
      }
      let userId: number;
      try {
        userId = parseUserId(adminHeader);
      } catch {
        return sendJson(res, 400, { error: "INVALID_USER_ID" });
      }

      const orgs = await loadOrganizationsForAdmin(userId);
      if (!orgs) {
        return sendJson(res, 401, { error: "ADMIN_UNAUTHORIZED" });
      }

      const companies = orgs.map((c) => ({
        id: String(c.id),
        name: c.nombre,
        slug: c.slug,
      }));
      return sendJson(res, 200, { adminId: String(userId), companies });
    }

    if (req.method === "POST" && pathname === "/api/v1/admin/select-company") {
      const body = await readBody(req);
      const adminHeader = String(req.headers["x-admin-id"] ?? "");
      const companyIdRaw = String(body.companyId ?? "");
      if (!adminHeader || !companyIdRaw) {
        return sendJson(res, 401, { error: "ADMIN_UNAUTHORIZED" });
      }
      let userId: number;
      let organizationId: number;
      try {
        userId = parseUserId(adminHeader);
        organizationId = parseOrganizationId(companyIdRaw);
      } catch {
        return sendJson(res, 400, { error: "INVALID_INPUT" });
      }

      const ok = await userHasOrganizationAccess(userId, organizationId);
      if (!ok) {
        return sendJson(res, 403, { error: "ADMIN_FORBIDDEN_COMPANY" });
      }

      adminSessions.set(String(userId), { selectedOrganizationId: organizationId });
      return sendJson(res, 200, { selectedCompanyId: String(organizationId) });
    }

    if (req.method === "GET" && pathname === "/api/v1/admin/clients") {
      const context = await requireAdminContext(req);
      const organizationId = parseOrganizationId(context.organizationId);
      const clients = await prisma.disisClient.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });
      const payload = clients.map((c) => ({
        id: String(c.id),
        companyId: String(c.organizationId),
        nationalId: c.nationalId,
        name: c.name,
        balance: Number(c.balance),
        qrSecret: c.qrSecret,
      }));
      return sendJson(res, 200, { companyId: context.organizationId, clients: payload });
    }

    if (req.method === "POST" && pathname === "/api/v1/clients/register") {
      const body = await readBody(req);
      const companyIdRaw = String(body.companyId ?? "");
      const nationalId = String(body.nationalId ?? "").trim();
      const name = String(body.name ?? "").trim();
      const initialBalance = Number(body.balance ?? 0);

      if (!companyIdRaw || !nationalId || !name) {
        return sendJson(res, 400, { error: "MISSING_CLIENT_FIELDS" });
      }

      let organizationId: number;
      try {
        organizationId = parseOrganizationId(companyIdRaw);
      } catch {
        return sendJson(res, 400, { error: "INVALID_ORGANIZATION_ID" });
      }

      const existing = await prisma.disisClient.findUnique({
        where: {
          organizationId_nationalId: { organizationId, nationalId },
        },
      });
      if (existing) {
        return sendJson(res, 409, { error: "CLIENT_ALREADY_EXISTS" });
      }

      const client = await prisma.disisClient.create({
        data: {
          organizationId,
          nationalId,
          name,
          balance: Number.isFinite(initialBalance) ? Math.max(0, initialBalance) : 0,
          qrSecret: generateClientQrSecret(),
        },
      });

      return sendJson(res, 201, {
        client: {
          id: String(client.id),
          companyId: String(client.organizationId),
          nationalId: client.nationalId,
          name: client.name,
          balance: Number(client.balance),
          qrSecret: client.qrSecret,
        },
      });
    }

    if (req.method === "GET" && pathname === "/api/v1/admin/inventory") {
      const context = await requireAdminContext(req);
      const organizationId = parseOrganizationId(context.organizationId);
      const products = await prisma.product.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
      });
      const inventory = products.map((p) => ({
        id: String(p.id),
        companyId: context.organizationId,
        name: p.name,
        stock: p.stock,
      }));
      return sendJson(res, 200, { companyId: context.organizationId, inventory });
    }

    if (req.method === "PATCH" && pathname === "/api/v1/admin/clients/balance") {
      const context = await requireAdminContext(req);
      const organizationId = parseOrganizationId(context.organizationId);
      const body = await readBody(req);
      const clientId = String(body.clientId ?? "");
      const nextBalance = Number(body.balance ?? Number.NaN);
      if (!clientId || Number.isNaN(nextBalance) || nextBalance < 0) {
        return sendJson(res, 400, { error: "INVALID_BALANCE_INPUT" });
      }

      const id = Number.parseInt(clientId, 10);
      if (!Number.isFinite(id)) {
        return sendJson(res, 400, { error: "INVALID_CLIENT_ID" });
      }

      const current = await prisma.disisClient.findFirst({
        where: { id, organizationId },
      });
      if (!current) {
        return sendJson(res, 404, { error: "CLIENT_NOT_FOUND" });
      }

      const updated = await prisma.disisClient.update({
        where: { id },
        data: { balance: nextBalance },
      });
      return sendJson(res, 200, {
        client: {
          id: String(updated.id),
          companyId: String(updated.organizationId),
          nationalId: updated.nationalId,
          name: updated.name,
          balance: Number(updated.balance),
        },
      });
    }

    if (req.method === "GET" && pathname === "/api/v1/admin/consumption-history") {
      const context = await requireAdminContext(req);
      const organizationId = parseOrganizationId(context.organizationId);
      const rows = await prisma.disisTransaction.findMany({
        where: {
          organizationId,
          type: "CONSUMPTION",
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      const history = rows.map((tx) => ({
        id: String(tx.id),
        companyId: String(tx.organizationId),
        clientId: String(tx.clientId),
        type: "CONSUMPTION",
        status: tx.status,
        amount: Number(tx.amount),
        quantity: tx.quantity != null ? Number(tx.quantity) : undefined,
        productId: tx.productId != null ? String(tx.productId) : undefined,
        inventorySyncStatus: tx.inventorySyncStatus,
        disisInventoryMovementId: tx.disisInventoryMovementId,
        createdAt: tx.createdAt.toISOString(),
      }));
      return sendJson(res, 200, { companyId: context.organizationId, history });
    }

    if (req.method === "POST" && pathname === "/api/v1/dispatch/search-by-national-id") {
      const role = String(req.headers["x-role"] ?? "");
      const body = await readBody(req);
      const companyId = String(body.companyId ?? "");
      const nationalId = String(body.nationalId ?? "");

      const client = await searchClientManually({
        role: role as "DISPATCHER" | "PUNTO_RETIRO",
        companyId,
        nationalId,
        repo,
      });
      return sendJson(res, 200, { client });
    }

    if (req.method === "POST" && pathname === "/api/v1/dispatch/validate-qr") {
      const body = await readBody(req);
      const companyId = String(body.companyId ?? "");
      const token = String(body.token ?? "");

      const client = await repo.findClientById(companyId, String(body.clientId ?? ""));
      if (!client) {
        return sendJson(res, 404, { error: "CLIENT_NOT_FOUND" });
      }

      validateDynamicQrToken(token, client.qrSecret);
      return sendJson(res, 200, { valid: true });
    }

    if (req.method === "POST" && pathname === "/api/v1/dispatch/consume") {
      const body = await readBody(req);
      const companyId = String(body.companyId ?? "");
      const clientId = String(body.clientId ?? "");
      const amount = Number(body.amount ?? 0);
      const quantity = Number(body.quantity ?? 0);
      const rawPid = body.productId ?? body.disisProductId;
      const productId = rawPid != null && String(rawPid).trim() !== "" ? String(rawPid) : undefined;
      const authToken = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

      const raw = await consumeDispatchAtomically(prisma, {
        companyId,
        clientId,
        amount,
        quantity: quantity > 0 ? quantity : undefined,
        productId,
      });
      const { nestSyncContext, ...result } = raw;
      let nestInventoryAudit = undefined as
        | Awaited<ReturnType<typeof registerNestMovementAfterDisisDispatch>>
        | undefined;
      if (nestSyncContext) {
        nestInventoryAudit = await registerNestMovementAfterDisisDispatch(prisma, {
          ...nestSyncContext,
          authToken,
        });
      }
      return sendJson(res, 200, {
        ...result,
        ...(nestInventoryAudit ? { nestInventoryAudit } : {}),
      });
    }

    if (req.method === "POST" && pathname === "/api/v1/dispatch/scan-qr") {
      const body = await readBody(req);
      const companyId = String(body.companyId ?? "");
      const nationalId = String(body.nationalId ?? "");
      const token = String(body.token ?? "");
      const lifeCard = await dispatchController.scanQR({
        companyId,
        nationalId,
        token,
      });
      return sendJson(res, 200, lifeCard);
    }

    if (req.method === "POST" && pathname === "/api/v1/dispatch/manual-search") {
      const body = await readBody(req);
      const companyId = String(body.companyId ?? "");
      const nationalId = String(body.nationalId ?? "");
      const pin = body.pin != null ? String(body.pin) : undefined;
      const lifeCard = await dispatchController.manualSearch({
        companyId,
        nationalId,
        pin,
      });
      return sendJson(res, 200, lifeCard);
    }

    if (req.method === "POST" && pathname === "/api/v1/dispatch/confirm-dispatch") {
      const body = await readBody(req);
      const companyId = String(body.companyId ?? "");
      const nationalId = String(body.nationalId ?? "");
      const amount = Number(body.amount ?? 0);
      const productId = body.productId != null ? String(body.productId) : undefined;
      const quantity = body.quantity != null ? Number(body.quantity) : undefined;
      const idempotencyKeyFromHeader = String(req.headers["x-idempotency-key"] ?? "").trim();
      const idempotencyKeyFromBody = body.idempotencyKey != null ? String(body.idempotencyKey).trim() : "";
      const idempotencyKey = idempotencyKeyFromHeader || idempotencyKeyFromBody || undefined;
      const authToken = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const raw = await dispatchController.confirmDispatch({
        companyId,
        nationalId,
        amount,
        productId,
        quantity,
        idempotencyKey,
      });
      const { nestSyncContext, ...result } = raw;
      let nestInventoryAudit = undefined as
        | Awaited<ReturnType<typeof registerNestMovementAfterDisisDispatch>>
        | undefined;
      if (nestSyncContext && !result.queuedOffline) {
        nestInventoryAudit = await registerNestMovementAfterDisisDispatch(prisma, {
          ...nestSyncContext,
          authToken,
        });
      }
      return sendJson(res, 200, {
        ...result,
        ...(nestInventoryAudit ? { nestInventoryAudit } : {}),
      });
    }

    return sendJson(res, 404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "ADMIN_UNAUTHORIZED" || message === "INVALID_USER_ID"
        ? 401
        : message === "ADMIN_FORBIDDEN_COMPANY" || message === "PIN_INVALID" || message === "ROLE_NOT_ALLOWED"
          ? 403
          : message === "ADMIN_ORGANIZATION_REQUIRED"
            ? 400
            : message === "INSUFFICIENT_STOCK" || message === "INSUFFICIENT_BALANCE"
              ? 409
              : message === "PRODUCT_NOT_FOUND" || message === "CLIENT_NOT_FOUND"
                ? 404
                : 400;
    return sendJson(res, status, { error: message });
  }
});

server.listen(port, () => {
  console.log(`[disis-monolith] running on port ${port}`);
});

process.on("SIGINT", () => {
  if (offlineSyncTimer) clearInterval(offlineSyncTimer);
  prisma.$disconnect().catch(() => {});
});

process.on("SIGTERM", () => {
  if (offlineSyncTimer) clearInterval(offlineSyncTimer);
  prisma.$disconnect().catch(() => {});
});
