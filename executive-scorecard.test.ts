import { describe, expect, it } from "vitest";
import { buildExecutiveScorecard } from "./executive-scorecard";

describe("buildExecutiveScorecard", () => {
  it("turns operational status into a CEO-level scorecard and action list", () => {
    const result = buildExecutiveScorecard({
      missions: [
        { status: "active", progress: 72 },
        { status: "active", progress: 68 },
        { status: "done", progress: 100 },
        { status: "approval", progress: 83 },
      ],
      agents: [
        { enabled: true },
        { enabled: true },
        { enabled: false },
        { enabled: true },
        { enabled: true },
        { enabled: true },
      ],
      settings: {
        dailyBudget: 1500,
        approvalLimit: 500,
      },
      tick: 12,
    });

    expect(result.scorecards.length).toBeGreaterThanOrEqual(4);
    expect(result.scorecards[0].value).toMatch(/%$/);
    expect(result.priorities.some((item) => item.toLowerCase().includes("aprobación"))).toBe(true);
  });
});
