import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import app from "./boot";

async function createTestToken(secret: string, tenantId: string, role: string) {
  return new SignJWT({ email: "test@example.invalid", name: "Test User", tenant_id: tenantId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("test-user")
    .setIssuer("adpulse")
    .setAudience("adpulse-api")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(secret));
}

describe("agent queue endpoint", () => {
  it("returns the live handoff queue and communication state for ECO-IA", async () => {
    const response = await app.request("http://localhost/api/saas/agents/queue");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.queue).toMatchObject({
      core: "ECO-IA",
      jobs: expect.any(Array),
      handoffs: expect.any(Array),
    });
  });

  it("advances a queued job through a live ECO-IA worker cycle", async () => {
    const response = await app.request("http://localhost/api/saas/agents/queue/advance", {
      method: "POST",
      headers: {
        "x-tenant-id": "tenant-qa",
        "x-user-role": "admin",
      },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.queue).toMatchObject({
      core: "ECO-IA",
      jobs: expect.any(Array),
    });
    expect(payload.queue.jobs.some((job: { status: string }) => job.status === "running" || job.status === "completed")).toBe(true);
  });

  it("requires explicit tenant access for queue writes and normalizes agent names", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAuthRequirement = process.env.REQUIRE_AGENT_QUEUE_AUTH;
    const originalSecret = process.env.ADPULSE_AUTH_JWT_SECRET;

    try {
      process.env.NODE_ENV = "test";
      process.env.REQUIRE_AGENT_QUEUE_AUTH = "true";
      process.env.ADPULSE_AUTH_JWT_SECRET = "test-secret-with-more-than-thirty-two-bytes";

      const unauthorized = await app.request("http://localhost/api/saas/agents/queue/enqueue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "Review regional demand", to: "explorador" }),
      });
      expect(unauthorized.status).toBe(401);

      const token = await createTestToken(process.env.ADPULSE_AUTH_JWT_SECRET, "tenant-qa", "admin");
      const authorized = await app.request("http://localhost/api/saas/agents/queue/enqueue", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ task: "Review regional demand", to: "explorador" }),
      });

      expect(authorized.status).toBe(200);
      const payload = await authorized.json();
      expect(payload.accepted).toBe(true);
      expect(payload.job.to).toBe("EXPLORADOR");
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAuthRequirement === undefined) delete process.env.REQUIRE_AGENT_QUEUE_AUTH;
      else process.env.REQUIRE_AGENT_QUEUE_AUTH = originalAuthRequirement;
      if (originalSecret === undefined) delete process.env.ADPULSE_AUTH_JWT_SECRET;
      else process.env.ADPULSE_AUTH_JWT_SECRET = originalSecret;
    }
  });

  it("rejects spoofed identity headers on production write routes", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAuthRequirement = process.env.REQUIRE_AGENT_QUEUE_AUTH;
    const originalSecret = process.env.ADPULSE_AUTH_JWT_SECRET;

    try {
      process.env.NODE_ENV = "production";
      process.env.REQUIRE_AGENT_QUEUE_AUTH = "true";
      process.env.ADPULSE_AUTH_JWT_SECRET = "test-secret-with-more-than-thirty-two-bytes";

      const response = await app.request("http://localhost/api/saas/agents/queue/enqueue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": "tenant-autofix",
          "x-user-role": "admin",
        },
        body: JSON.stringify({ task: "Must not be queued", to: "EXPLORADOR" }),
      });

      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("QUEUE_AUTH_REQUIRED");
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAuthRequirement === undefined) delete process.env.REQUIRE_AGENT_QUEUE_AUTH;
      else process.env.REQUIRE_AGENT_QUEUE_AUTH = originalAuthRequirement;
      if (originalSecret === undefined) delete process.env.ADPULSE_AUTH_JWT_SECRET;
      else process.env.ADPULSE_AUTH_JWT_SECRET = originalSecret;
    }
  });

  it("verifies production JWTs and denies cross-tenant writes", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAuthRequirement = process.env.REQUIRE_AGENT_QUEUE_AUTH;
    const originalSecret = process.env.ADPULSE_AUTH_JWT_SECRET;
    const secret = "test-secret-with-more-than-thirty-two-bytes";

    try {
      process.env.NODE_ENV = "production";
      process.env.REQUIRE_AGENT_QUEUE_AUTH = "true";
      process.env.ADPULSE_AUTH_JWT_SECRET = secret;
      const token = await createTestToken(secret, "tenant-autofix", "admin");

      const crossTenant = await app.request("http://localhost/api/saas/governance/Ruta%2024/activate", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ mode: "safe-mode" }),
      });
      expect(crossTenant.status).toBe(403);
      expect((await crossTenant.json()).code).toBe("TENANT_ACCESS_DENIED");

      const ownTenant = await app.request("http://localhost/api/saas/governance/Autofix%20Center/activate", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ mode: "safe-mode" }),
      });
      expect(ownTenant.status).toBe(200);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAuthRequirement === undefined) delete process.env.REQUIRE_AGENT_QUEUE_AUTH;
      else process.env.REQUIRE_AGENT_QUEUE_AUTH = originalAuthRequirement;
      if (originalSecret === undefined) delete process.env.ADPULSE_AUTH_JWT_SECRET;
      else process.env.ADPULSE_AUTH_JWT_SECRET = originalSecret;
    }
  });

  it("protects tenant reads and platform-wide data in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAuthRequirement = process.env.REQUIRE_AGENT_QUEUE_AUTH;
    const originalSecret = process.env.ADPULSE_AUTH_JWT_SECRET;
    const secret = "test-secret-with-more-than-thirty-two-bytes";

    try {
      process.env.NODE_ENV = "production";
      process.env.REQUIRE_AGENT_QUEUE_AUTH = "true";
      process.env.ADPULSE_AUTH_JWT_SECRET = secret;

      const anonymous = await app.request("http://localhost/api/saas/billing/Autofix%20Center");
      expect(anonymous.status).toBe(401);

      const tenantToken = await createTestToken(secret, "tenant-autofix", "admin");
      const ownBilling = await app.request("http://localhost/api/saas/billing/Autofix%20Center", {
        headers: { authorization: `Bearer ${tenantToken}` },
      });
      expect(ownBilling.status).toBe(200);

      const crossTenantBilling = await app.request("http://localhost/api/saas/billing/Ruta%2024", {
        headers: { authorization: `Bearer ${tenantToken}` },
      });
      expect(crossTenantBilling.status).toBe(403);

      const nonAdminSummary = await app.request("http://localhost/api/saas/summary", {
        headers: { authorization: `Bearer ${tenantToken}` },
      });
      expect(nonAdminSummary.status).toBe(403);

      const platformToken = await createTestToken(secret, "platform", "platform_admin");
      const platformSummary = await app.request("http://localhost/api/saas/summary", {
        headers: { authorization: `Bearer ${platformToken}` },
      });
      expect(platformSummary.status).toBe(200);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAuthRequirement === undefined) delete process.env.REQUIRE_AGENT_QUEUE_AUTH;
      else process.env.REQUIRE_AGENT_QUEUE_AUTH = originalAuthRequirement;
      if (originalSecret === undefined) delete process.env.ADPULSE_AUTH_JWT_SECRET;
      else process.env.ADPULSE_AUTH_JWT_SECRET = originalSecret;
    }
  });

  it("exposes the live ECO-IA runtime health inside the SaaS API", async () => {
    const response = await app.request("http://localhost/api/saas/agents/network");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.network.agentRuntime).toMatchObject({
      service: "eco-ia",
      status: "ok",
      agents: expect.any(Number),
    });
  });

  it("reports the overall SaaS runtime health and dependency status", async () => {
    const response = await app.request("http://localhost/api/saas/platform/health");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ready).toBe(true);
    expect(payload.services).toMatchObject({
      app: expect.objectContaining({ status: "healthy" }),
      ecoIa: expect.objectContaining({ service: "eco-ia" }),
      queue: expect.objectContaining({ mode: expect.any(String) }),
    });
  });

  it("persists a tenant audit trail for authenticated queue operations", async () => {
    const enqueue = await app.request("http://localhost/api/saas/agents/queue/enqueue", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-audit",
        "x-user-role": "admin",
      },
      body: JSON.stringify({ task: "Audit tenant workflow", to: "EXPLORADOR" }),
    });

    expect(enqueue.status).toBe(200);

    const audit = await app.request("http://localhost/api/saas/audit/tenant/tenant-audit");
    expect(audit.status).toBe(200);

    const payload = await audit.json();
    expect(payload.events.some((event: { action: string; tenantId: string }) => {
      return event.action === "enqueue" && event.tenantId === "tenant-audit";
    })).toBe(true);
  });

  it("reports safe-mode for unverified business connectors and permits manual execution", async () => {
    const summary = await app.request("http://localhost/api/saas/business/tenant/Autofix%20Center");
    expect(summary.status).toBe(200);

    const payload = await summary.json();
    expect(payload.business).toMatchObject({
      tenantName: "Autofix Center",
      status: "safe-mode",
      mode: "safe-mode",
      health: "protected",
      automationCoverage: 0,
    });
    expect(payload.workflows.every((workflow: { status: string; automation: string }) =>
      workflow.status === "blocked" && workflow.automation === "manual-review",
    )).toBe(true);
    expect(payload.connectors.some((connector: { name: string }) => connector.name === "CRM")).toBe(true);
    expect(payload.connectors.every((connector: { status: string }) => connector.status !== "online")).toBe(true);
    expect(payload.connectors.some((connector: { status: string }) => connector.status === "pending")).toBe(true);

    const execute = await app.request("http://localhost/api/saas/business/tenant/Autofix%20Center/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-autofix",
        "x-user-role": "admin",
      },
      body: JSON.stringify({ workflow: "lead_follow_up", mode: "manual" }),
    });

    expect(execute.status).toBe(200);
    const result = await execute.json();
    expect(result.accepted).toBe(true);
    expect(result.workflow).toBe("lead_follow_up");
  });

  it("exposes the tenant governance posture and safe-mode controls when connectors are still pending", async () => {
    const response = await app.request("http://localhost/api/saas/governance/Autofix%20Center");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.governance).toMatchObject({
      tenantName: "Autofix Center",
      mode: "safe-mode",
      controls: expect.any(Array),
      connectors: expect.any(Array),
    });
    expect(payload.governance.controls.some((control: { name: string }) => control.name === "RBAC")).toBe(true);
    expect(payload.governance.connectors.some((connector: { status: string }) => connector.status === "pending")).toBe(true);
  });

  it("blocks autonomous business execution while the tenant platform is in safe-mode", async () => {
    const response = await app.request("http://localhost/api/saas/business/tenant/Autofix%20Center/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-autofix",
        "x-user-role": "admin",
      },
      body: JSON.stringify({ workflow: "lead_follow_up", mode: "autonomous" }),
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.code).toBe("SAFE_MODE_BLOCKED");
    expect(payload.mode).toBe("safe-mode");
  });

  it("refuses to activate autonomous mode until the required connector config is present", async () => {
    const response = await app.request("http://localhost/api/saas/governance/Autofix%20Center/activate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-autofix",
        "x-user-role": "admin",
      },
      body: JSON.stringify({ mode: "autonomous" }),
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.code).toBe("SAFE_MODE_BLOCKED");
    expect(payload.governance.mode).toBe("safe-mode");
  });

  it("does not report configured credentials as live integrations or enable autonomous mode", async () => {
    const keys = [
      "CRM_API_KEY", "CRM_BASE_URL", "CRM_WEBHOOK_URL",
      "ADS_API_KEY", "META_ADS_TOKEN", "ADS_ACCOUNT_ID",
      "ERP_API_URL", "ERP_API_KEY", "ERP_CLIENT_ID",
      "BILLING_API_KEY", "STRIPE_SECRET_KEY", "BILLING_API_URL",
      "NOTIFY_API_KEY", "SLACK_WEBHOOK_URL", "RESEND_API_KEY",
    ];
    const originalValues = new Map(keys.map((key) => [key, process.env[key]]));

    try {
      for (const key of keys) {
        process.env[key] = `test-value-${key}`;
      }

      const response = await app.request("http://localhost/api/saas/governance/Autofix%20Center");
      const payload = await response.json();

      expect(payload.governance.mode).toBe("safe-mode");
      expect(payload.governance.connectors.every((connector: { configured: boolean; ready: boolean; status: string }) =>
        connector.configured && !connector.ready && connector.status === "configured",
      )).toBe(true);
    } finally {
      for (const [key, value] of originalValues) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("cleans stale failed jobs before reporting the queue as healthy", async () => {
    const dataDir = join(process.cwd(), ".data");
    mkdirSync(dataDir, { recursive: true });
    const queuePath = join(dataDir, "eco-ia-queue.json");

    writeFileSync(queuePath, JSON.stringify({
      core: "ECO-IA",
      queueName: "eco-ia-live-queue",
      cycle: 2,
      lastUpdated: new Date().toISOString(),
      jobs: [
        { id: "stale-1", from: "ECO-IA", to: "EXPLORADOR", task: "old failed task", status: "failed", lastMessage: "stale" },
        { id: "stale-2", from: "ECO-IA", to: "EXPLORADOR", task: "another stale task", status: "failed", lastMessage: "stale" },
      ],
      handoffs: [],
    }, null, 2));

    const response = await app.request("http://localhost/api/saas/platform/health");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ready).toBe(true);
    expect(payload.services.queue.failedJobs).toBe(0);
  });
});
