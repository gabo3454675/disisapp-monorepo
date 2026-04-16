/** companyId en API = id numérico de Organization (misma convención que x-tenant-id en Nest). */
export function parseOrganizationId(companyId: string): number {
  const n = Number.parseInt(String(companyId).trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("INVALID_ORGANIZATION_ID");
  }
  return n;
}

export function parseUserId(headerValue: string): number {
  const n = Number.parseInt(String(headerValue).trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("INVALID_USER_ID");
  }
  return n;
}
