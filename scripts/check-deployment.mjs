// A successful frontend build alone does not prove that the API is available.
const input = process.argv[2];
if (!input) {
  console.error("Aufruf: npm run deployment:check -- https://deine-domain");
  process.exit(1);
}
const base = new URL(input);
if (
  !["http:", "https:"].includes(base.protocol) ||
  base.username ||
  base.password
) {
  throw new Error("Eine HTTP-/HTTPS-Adresse ohne Zugangsdaten angeben.");
}
const checks = [
  {
    path: "/api/auth/me/",
    valid: (data) => typeof data.authenticated === "boolean",
  },
  { path: "/api/health/", valid: (data) => data.status === "ok" },
];
let failed = false;
for (const check of checks) {
  try {
    const response = await fetch(new URL(check.path, base), {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Keine JSON-Antwort; API-Routing prüfen.");
    }
    if (!check.valid(await response.json()))
      throw new Error("Unerwartete API-Antwort.");
    console.log(`OK ${check.path}`);
  } catch (error) {
    failed = true;
    console.error(`FEHLER ${check.path}: ${error.message}`);
  }
}
if (failed) {
  console.error("Die Anwendung ist noch nicht vollständig erreichbar.");
  process.exitCode = 1;
}
