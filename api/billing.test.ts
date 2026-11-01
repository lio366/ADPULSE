import { describe, expect, it } from "vitest";
import app from "./boot";

describe("tenant billing endpoint", () => {
  it("returns account plan, renewal status and invoice details", async () => {
    const response = await app.request("http://localhost/api/saas/billing/Autofix%20Center");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.billing).toMatchObject({
      tenantName: "Autofix Center",
      plan: "Pro",
      status: "Pagado",
      nextInvoice: expect.any(String),
      seatsInUse: expect.any(Number),
    });
  });
});
