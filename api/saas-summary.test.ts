import { describe, expect, it } from "vitest";
import app from "./boot";

describe("saas summary endpoint", () => {
  it("returns the operational snapshot for the multi-tenant dashboard", async () => {
    const response = await app.request("http://localhost/api/saas/summary");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.summary).toMatchObject({
      leadsQualified: expect.any(Number),
      activeOpportunities: expect.any(Number),
      automatedTasks: expect.any(Number),
      roiEstimated: expect.any(String),
    });
    expect(Array.isArray(payload.tenants)).toBe(true);
    expect(Array.isArray(payload.roles)).toBe(true);
  });
});
