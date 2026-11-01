import { describe, expect, it } from "vitest";
import app from "./boot";

describe("agents network endpoint", () => {
  it("returns the 24/7 coordination graph between ECO-IA agents", async () => {
    const response = await app.request("http://localhost/api/saas/agents/network");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.network).toMatchObject({
      core: "ECO-IA",
      agents: expect.any(Array),
      flows: expect.any(Array),
      health: expect.any(String),
    });
  });
});
