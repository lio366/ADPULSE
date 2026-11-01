import { describe, expect, it } from "vitest";
import app from "./boot";

describe("tenant onboarding endpoint", () => {
  it("returns checklist, owners and activation status for the selected client", async () => {
    const response = await app.request("http://localhost/api/saas/onboarding/Autofix%20Center");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.onboarding).toMatchObject({
      tenantName: "Autofix Center",
      status: "Activación 72%",
      checklist: expect.any(Array),
      owners: expect.any(Array),
    });
  });
});
