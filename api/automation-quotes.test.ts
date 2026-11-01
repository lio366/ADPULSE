import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "./boot";

const quotesPath = join(tmpdir(), `adpulse-quotes-${process.pid}.json`);
const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  requireAuth: process.env.REQUIRE_AGENT_QUEUE_AUTH,
  quotesPath: process.env.AUTOMATION_QUOTES_PATH,
};
const tenantHeaders = { "x-tenant-id": "tenant-autofix", "x-user-role": "admin" };

beforeEach(() => {
  process.env.NODE_ENV = "test";
  delete process.env.REQUIRE_AGENT_QUEUE_AUTH;
  process.env.AUTOMATION_QUOTES_PATH = quotesPath;
  writeFileSync(quotesPath, "[]\n");
});

afterEach(() => {
  try { unlinkSync(quotesPath); } catch { /* The test may fail before storage is created. */ }
  if (originalEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment.nodeEnv;
  if (originalEnvironment.requireAuth === undefined) delete process.env.REQUIRE_AGENT_QUEUE_AUTH;
  else process.env.REQUIRE_AGENT_QUEUE_AUTH = originalEnvironment.requireAuth;
  if (originalEnvironment.quotesPath === undefined) delete process.env.AUTOMATION_QUOTES_PATH;
  else process.env.AUTOMATION_QUOTES_PATH = originalEnvironment.quotesPath;
});

describe("automation quote lifecycle", () => {
  it("calculates monthly prices on the server and persists a tenant proposal", async () => {
    const catalogResponse = await app.request("http://localhost/api/saas/automation/catalog");
    const catalog = await catalogResponse.json();
    expect(catalog.automations).toHaveLength(5);

    const response = await app.request("http://localhost/api/saas/quotes/Autofix%20Center", {
      method: "POST",
      headers: { ...tenantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ automationIds: ["lead_follow_up", "notifications"], monthlyTotalCents: 1 }),
    });

    expect(response.status).toBe(201);
    const { quote } = await response.json();
    expect(quote.monthlyTotalCents).toBe(7800);
    expect(quote.status).toBe("proposed");

    const list = await app.request("http://localhost/api/saas/quotes/Autofix%20Center", { headers: tenantHeaders });
    expect((await list.json()).quotes).toHaveLength(1);
    const otherTenant = await app.request("http://localhost/api/saas/quotes/Ruta%2024", { headers: tenantHeaders });
    expect((await otherTenant.json()).quotes).toHaveLength(0);
  });

  it("records explicit acceptance but waits for a verified connector", async () => {
    const created = await app.request("http://localhost/api/saas/quotes/Autofix%20Center", {
      method: "POST",
      headers: { ...tenantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ automationIds: ["campaign_optimizer"] }),
    });
    const { quote: proposal } = await created.json();

    const accepted = await app.request(`http://localhost/api/saas/quotes/Autofix%20Center/${proposal.id}/decision`, {
      method: "POST",
      headers: { ...tenantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ decision: "accepted" }),
    });
    expect(accepted.status).toBe(200);
    const { quote } = await accepted.json();
    expect(quote.status).toBe("accepted");
    expect(quote.activations).toEqual([
      { automationId: "campaign_optimizer", connector: "Ads", status: "waiting_for_integration" },
    ]);

    const duplicateDecision = await app.request(`http://localhost/api/saas/quotes/Autofix%20Center/${proposal.id}/decision`, {
      method: "POST",
      headers: { ...tenantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ decision: "accepted" }),
    });
    expect(duplicateDecision.status).toBe(409);
  });

  it("records rejection without activating automations", async () => {
    const created = await app.request("http://localhost/api/saas/quotes/Autofix%20Center", {
      method: "POST",
      headers: { ...tenantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ automationIds: ["renewal_alerts"] }),
    });
    const { quote: proposal } = await created.json();

    const rejected = await app.request(`http://localhost/api/saas/quotes/Autofix%20Center/${proposal.id}/decision`, {
      method: "POST",
      headers: { ...tenantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ decision: "rejected" }),
    });
    const { quote } = await rejected.json();
    expect(quote.status).toBe("rejected");
    expect(quote.activations).toEqual([]);
  });
});
