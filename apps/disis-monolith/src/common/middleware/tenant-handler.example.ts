import type { Request, Response } from "express";
import { createTenantHandler, type TenantAccessRepository, type TenantAwareRequest } from "./tenant-handler.js";

const repo: TenantAccessRepository = {
  async hasAdminAccessToCompany(userId, companyId) {
    // TODO: Reemplazar por query Prisma a UserCompany:
    // await prisma.userCompany.findFirst({ where: { userId, companyId } })
    return userId.length > 0 && companyId.length > 0;
  },
  async getDispatcherCompanyId(userId) {
    // TODO: Reemplazar por query Prisma a User o tabla de asignación.
    return userId ? "company_a" : null;
  },
};

export const tenantHandler = createTenantHandler(repo);

export async function listClients(req: TenantAwareRequest, res: Response): Promise<void> {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(400).json({ error: "TENANT_CONTEXT_REQUIRED" });
    return;
  }

  // Prisma multi-tenant: siempre filtrar por req.companyId
  // const clients = await prisma.client.findMany({ where: { companyId } });
  res.status(200).json({ message: "OK", companyId });
}

export function withExpressExample(_req: Request, _res: Response): void {
  // Ejemplo de uso en Express:
  // app.get("/api/v1/clients", authMiddleware, tenantHandler, listClients);
}
