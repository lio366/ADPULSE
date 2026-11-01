import { performance } from "node:perf_hooks";
import { SignJWT } from "jose";

const baseUrl = new URL(process.env.SIMULATION_BASE_URL ?? "http://127.0.0.1:3456");
const ecoIaUrl = new URL(process.env.SIMULATION_ECOIA_URL ?? "http://127.0.0.1:8001");
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const requestCount = Number(process.env.SIMULATION_REQUESTS ?? 800);
const concurrency = Number(process.env.SIMULATION_CONCURRENCY ?? 40);
const simulationJwtSecret = process.env.SIMULATION_JWT_SECRET;

for (const target of [baseUrl, ecoIaUrl]) {
  if (target.protocol !== "http:" || !localHosts.has(target.hostname)) {
    throw new Error("Simulation only permits HTTP requests to localhost or loopback addresses.");
  }
}
if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 2000) {
  throw new Error("SIMULATION_REQUESTS must be an integer from 1 to 2000.");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 40) {
  throw new Error("SIMULATION_CONCURRENCY must be an integer from 1 to 40.");
}
if (simulationJwtSecret && new TextEncoder().encode(simulationJwtSecret).byteLength < 32) {
  throw new Error("SIMULATION_JWT_SECRET must contain at least 32 bytes.");
}

const requestHeaders = simulationJwtSecret
  ? {
      authorization: `Bearer ${await new SignJWT({ tenant_id: "platform", role: "platform_admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode(simulationJwtSecret))}`,
    }
  : undefined;

const planPrices = { Starter: 29900, Growth: 59900, Scale: 99900 };
const automationPrices = {
  "Lead follow-up": 4900,
  "Campaign optimizer": 12900,
  "Renewal alerts": 3900,
  "Operations scheduling": 8900,
  Notifications: 2900,
};

const clients = [
  { name: "Sunrise Auto Care", plan: "Starter", accepted: ["Lead follow-up", "Notifications"] },
  { name: "Lone Star Fleet", plan: "Growth", accepted: [] },
  { name: "Peachtree Motors", plan: "Starter", accepted: ["Campaign optimizer", "Renewal alerts"] },
  { name: "Gulf Coast Service", plan: "Growth", accepted: ["Lead follow-up", "Operations scheduling"] },
  { name: "Blue Ridge Garage", plan: "Starter", accepted: [] },
  { name: "Metro Tire Group", plan: "Scale", accepted: ["Lead follow-up", "Renewal alerts", "Notifications"] },
  { name: "Desert Roadside", plan: "Starter", accepted: ["Notifications"] },
  { name: "Capitol Auto Works", plan: "Growth", accepted: [] },
  { name: "Evergreen Motors", plan: "Scale", accepted: ["Campaign optimizer", "Renewal alerts", "Operations scheduling"] },
  { name: "Coastal Repair Network", plan: "Growth", accepted: ["Lead follow-up", "Campaign optimizer", "Notifications"] },
].map((client) => {
  const offeredCents = planPrices[client.plan]
    + client.accepted.reduce((total, automation) => total + automationPrices[automation], 0);
  const offerAccepted = client.accepted.length > 0;

  return {
    ...client,
    offerAccepted,
    offeredCents,
    bookedCents: offerAccepted ? offeredCents : 0,
    declined: Object.keys(automationPrices).filter((automation) => !client.accepted.includes(automation)),
  };
});

function dollars(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const acceptedClients = clients.filter((client) => client.offerAccepted).length;
const proposedMrr = clients.reduce((total, client) => total + client.offeredCents, 0);
const bookedMrr = clients.reduce((total, client) => total + client.bookedCents, 0);

console.log("COHORTE SIMULADA (datos sinteticos; no se crean cuentas ni cargos)");
console.table(clients.map((client) => ({
  cliente: client.name,
  plan: client.plan,
  oferta: client.offerAccepted ? "ACEPTADA" : "RECHAZADA",
  precioMensual: dollars(client.offeredCents),
  automatizacionesAceptadas: client.accepted.join(", ") || "ninguna",
  rechazadas: client.declined.join(", ") || "ninguna",
})));
console.log(`Clientes: ${clients.length}; aceptan: ${acceptedClients}; rechazan: ${clients.length - acceptedClients}`);
console.log(`MRR propuesto: ${dollars(proposedMrr)}; MRR aceptado simulado: ${dollars(bookedMrr)}`);

const targets = [
  { name: "ADPULSE health", url: new URL("/api/health", baseUrl) },
  { name: "ADPULSE platform summary", url: new URL("/api/saas/summary", baseUrl) },
  { name: "ADPULSE tenant", url: new URL("/api/saas/tenant/Autofix%20Center", baseUrl) },
  { name: "ADPULSE billing", url: new URL("/api/saas/billing/Autofix%20Center", baseUrl) },
  { name: "ADPULSE RBAC", url: new URL("/api/saas/rbac/Autofix%20Center", baseUrl) },
  { name: "ADPULSE onboarding", url: new URL("/api/saas/onboarding/Autofix%20Center", baseUrl) },
  { name: "ADPULSE governance", url: new URL("/api/saas/governance/Autofix%20Center", baseUrl) },
  { name: "ADPULSE business workflows", url: new URL("/api/saas/business/tenant/Autofix%20Center", baseUrl) },
  { name: "ADPULSE tenant audit", url: new URL("/api/saas/audit/tenant/tenant-autofix", baseUrl) },
  { name: "ADPULSE agent network", url: new URL("/api/saas/agents/network", baseUrl) },
  { name: "ECO-IA health", url: new URL("/health", ecoIaUrl) },
  { name: "ECO-IA agents", url: new URL("/agents", ecoIaUrl) },
];

const health = await fetch(targets[0].url, { signal: AbortSignal.timeout(5000) });
if (!health.ok) {
  throw new Error(`Local API health check failed with HTTP ${health.status}.`);
}
await health.arrayBuffer();
const ecoHealth = await fetch(targets[10].url, { signal: AbortSignal.timeout(5000) });
if (!ecoHealth.ok) {
  throw new Error(`Local ECO-IA health check failed with HTTP ${ecoHealth.status}.`);
}
await ecoHealth.arrayBuffer();

const latencies = [];
const failures = [];
const routeResults = targets.map((target) => ({ name: target.name, successes: 0, failures: 0, latencies: [] }));
let responseBytes = 0;
let nextRequest = 0;
const stressStarted = performance.now();

async function worker() {
  while (nextRequest < requestCount) {
    const requestIndex = nextRequest++;
    const routeIndex = requestIndex % targets.length;
    const target = targets[routeIndex];
    const started = performance.now();

    try {
      const response = await fetch(target.url, { headers: requestHeaders, signal: AbortSignal.timeout(10000) });
      const body = await response.arrayBuffer();
      const latency = performance.now() - started;
      latencies.push(latency);
      routeResults[routeIndex].latencies.push(latency);
      responseBytes += body.byteLength;
      if (response.ok) {
        routeResults[routeIndex].successes += 1;
      } else {
        routeResults[routeIndex].failures += 1;
        failures.push(`${target.name}: HTTP ${response.status}`);
      }
    } catch (error) {
      routeResults[routeIndex].failures += 1;
      failures.push(`${target.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()));

const elapsedMs = performance.now() - stressStarted;
latencies.sort((left, right) => left - right);
const percentile = (fraction) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * fraction))] ?? 0;
const result = {
  target: baseUrl.origin,
  ecoIaTarget: ecoIaUrl.origin,
  requests: requestCount,
  concurrency: Math.min(concurrency, requestCount),
  successes: requestCount - failures.length,
  failures: failures.length,
  elapsedMs: Number(elapsedMs.toFixed(1)),
  requestsPerSecond: Number((requestCount / (elapsedMs / 1000)).toFixed(1)),
  latencyMs: {
    p50: Number(percentile(0.50).toFixed(1)),
    p95: Number(percentile(0.95).toFixed(1)),
    max: Number((latencies.at(-1) ?? 0).toFixed(1)),
  },
  responseBytes,
  routes: routeResults.map(({ name, successes, failures: routeFailures, latencies: routeLatencies }) => {
    routeLatencies.sort((left, right) => left - right);
    const routeP95 = routeLatencies[Math.min(routeLatencies.length - 1, Math.floor(routeLatencies.length * 0.95))] ?? 0;
    return { name, requests: successes + routeFailures, successes, failures: routeFailures, p95Ms: Number(routeP95.toFixed(1)) };
  }),
};

console.log("PRUEBA DE CARGA E2E (GET loopback; rutas de escritura/agentes mutativos excluidas)");
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) {
  console.error("Primeros errores:", failures.slice(0, 5));
  process.exitCode = 1;
}