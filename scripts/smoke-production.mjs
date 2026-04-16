/**
 * Smoke tests post-deploy (producción o staging).
 * Uso:
 *   node scripts/smoke-production.mjs
 *   SMOKE_API_URL=https://tu-backend.onrender.com/api node scripts/smoke-production.mjs
 *
 * Requiere Node 18+ (fetch nativo).
 */

const API_BASE = (process.env.SMOKE_API_URL ?? "https://disisapp-monorepo-backend-ymda.onrender.com/api").replace(
  /\/$/,
  "",
);

async function main() {
  console.log(`[smoke] API_BASE=${API_BASE}\n`);

  // 1) Health del backend principal
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthText = await healthRes.text();
  console.log(`[smoke] GET /api/health -> ${healthRes.status}`);
  if (!healthRes.ok) {
    console.error(healthText);
    process.exit(1);
  }
  console.log(`[smoke] body: ${healthText.slice(0, 200)}${healthText.length > 200 ? "..." : ""}\n`);

  // 2) Dispatch público (proxy -> disis-monolith). Puede fallar 400/502 si no hay datos o DISIS_MONOLITH_URL mal.
  const dispatchRes = await fetch(`${API_BASE}/dispatch/search-by-national-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId: "company_a",
      nationalId: "V12345678",
    }),
  });
  const dispatchText = await dispatchRes.text();
  console.log(`[smoke] POST /api/dispatch/search-by-national-id -> ${dispatchRes.status}`);
  console.log(`[smoke] body: ${dispatchText.slice(0, 500)}${dispatchText.length > 500 ? "..." : ""}`);

  if (dispatchRes.status === 502 || dispatchRes.status === 503) {
    console.error(
      "\n[smoke] FAIL: Revisa DISIS_MONOLITH_URL en el backend y que el servicio disis-monolith esté activo.",
    );
    process.exit(1);
  }

  console.log("\n[smoke] OK (revisa manualmente 404/400 si aún no hay clientes de prueba en DB).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
