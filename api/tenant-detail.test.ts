import { describe, expect, it } from "vitest";
import app from "./boot";

describe("tenant detail endpoint", () => {
  it("returns the selected tenant profile and access scope", async () => {
    const response = await app.request("http://localhost/api/saas/tenant/Autofix%20Center");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.tenant).toMatchObject({
      name: "Autofix Center",
      plan: "Pro",
      seats: expect.any(Number),
      permissions: expect.any(Array),
    });
  });
});
