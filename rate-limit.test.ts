import { afterEach, describe, expect, it } from "vitest";
import { consumeLocalLimit, resetLocalLimitsForTests } from "./rate-limit";

afterEach(resetLocalLimitsForTests);
describe("local rate-limit primitive", () => {
  it("allows requests up to the configured limit and blocks the next", () => {
    expect(consumeLocalLimit("ip:1", 2, 1000, 10).allowed).toBe(true);
    expect(consumeLocalLimit("ip:1", 2, 1000, 11).allowed).toBe(true);
    expect(consumeLocalLimit("ip:1", 2, 1000, 12).allowed).toBe(false);
  });
  it("resets after the window", () => {
    consumeLocalLimit("ip:1", 1, 1000, 10);
    expect(consumeLocalLimit("ip:1", 1, 1000, 1010).allowed).toBe(true);
  });
});
