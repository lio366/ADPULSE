import { describe, expect, it } from "vitest";
import app from "./boot";

describe("tenant RBAC endpoint", () => {
  it("returns the roles, members and access matrix for a tenant", async () => {
    const response = await app.request("http://localhost/api/saas/rbac/Autofix%20Center");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.rbac).toMatchObject({
      tenantName: "Autofix Center",
      roles: expect.any(Array),
      members: expect.any(Array),
      policy: expect.any(String),
    });
  });
});
