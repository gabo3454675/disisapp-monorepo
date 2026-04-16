import type { NextFunction, Request, Response } from "express";

export type TenantRole = "SUPERADMIN" | "ADMIN" | "CASHIER" | "DISPATCHER";

export type TenantAuthUser = {
  id: string;
  role: TenantRole;
  companyId?: string;
};

export type TenantAccessRepository = {
  hasAdminAccessToCompany(userId: string, companyId: string): Promise<boolean>;
  getDispatcherCompanyId(userId: string): Promise<string | null>;
};

export type TenantAwareRequest = Request & {
  user?: TenantAuthUser;
  companyId?: string;
};

export function createTenantHandler(repo: TenantAccessRepository) {
  return async function tenantHandler(
    req: TenantAwareRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companyIdFromHeader = String(req.headers["company-id"] ?? "").trim();
      if (!companyIdFromHeader) {
        res.status(400).json({ error: "COMPANY_ID_REQUIRED" });
        return;
      }

      const user = req.user;
      if (!user) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }

      if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
        const hasAccess = await repo.hasAdminAccessToCompany(user.id, companyIdFromHeader);
        if (!hasAccess) {
          res.status(403).json({ error: "TENANT_FORBIDDEN" });
          return;
        }
        req.companyId = companyIdFromHeader;
        next();
        return;
      }

      if (user.role === "DISPATCHER") {
        const dispatcherCompanyId = user.companyId ?? (await repo.getDispatcherCompanyId(user.id));
        if (!dispatcherCompanyId || dispatcherCompanyId !== companyIdFromHeader) {
          res.status(403).json({ error: "TENANT_FORBIDDEN" });
          return;
        }
        req.companyId = dispatcherCompanyId;
        next();
        return;
      }

      res.status(403).json({ error: "ROLE_NOT_ALLOWED" });
    } catch {
      res.status(500).json({ error: "TENANT_HANDLER_ERROR" });
    }
  };
}
