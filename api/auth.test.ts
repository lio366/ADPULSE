import { describe, expect, it } from "vitest";
import app from "./boot";
import { getAccessTokenConstraints, hashPassword, verifyPassword } from "./auth";

describe("local authentication", () => {
  it("stores passwords as salted scrypt hashes and verifies them safely", async () => {
    const hash = hashPassword("correct-horse-battery-42");
    expect(hash).toMatch(/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(await verifyPassword("correct-horse-battery-42", hash)).toBe(true);
    expect(await verifyPassword("incorrect-password", hash)).toBe(false);
    expect(await verifyPassword("anything", "invalid-hash")).toBe(false);
  });

  it("rejects the example signing secret", () => {
    const originalSecret = process.env.ADPULSE_AUTH_JWT_SECRET;
    try {
      process.env.ADPULSE_AUTH_JWT_SECRET = "replace-with-a-random-secret-at-least-32-bytes";
      expect(getAccessTokenConstraints()).toBeNull();
    } finally {
      if (originalSecret === undefined) delete process.env.ADPULSE_AUTH_JWT_SECRET;
      else process.env.ADPULSE_AUTH_JWT_SECRET = originalSecret;
    }
  });

  it("fails closed when the database-backed identity store is unavailable", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalSecret = process.env.ADPULSE_AUTH_JWT_SECRET;
    try {
      delete process.env.DATABASE_URL;
      process.env.ADPULSE_AUTH_JWT_SECRET = "test-secret-with-more-than-thirty-two-bytes";
      const response = await app.request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@example.test", password: "correct-horse-battery-42", tenantId: "tenant-autofix" }),
      });
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe("AUTH_UNAVAILABLE");
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      if (originalSecret === undefined) delete process.env.ADPULSE_AUTH_JWT_SECRET;
      else process.env.ADPULSE_AUTH_JWT_SECRET = originalSecret;
    }
  });

  it("requires a valid token for session introspection and clears the cookie on logout", async () => {
    const originalSecret = process.env.ADPULSE_AUTH_JWT_SECRET;
    try {
      process.env.ADPULSE_AUTH_JWT_SECRET = "test-secret-with-more-than-thirty-two-bytes";
      const anonymous = await app.request("http://localhost/api/auth/session");
      expect(anonymous.status).toBe(401);

      const logout = await app.request("http://localhost/api/auth/logout", { method: "POST" });
      expect(logout.status).toBe(200);
      expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    } finally {
      if (originalSecret === undefined) delete process.env.ADPULSE_AUTH_JWT_SECRET;
      else process.env.ADPULSE_AUTH_JWT_SECRET = originalSecret;
    }
  });
});