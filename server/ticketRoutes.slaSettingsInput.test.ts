import { describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ storage: {} }));
vi.mock("./ticketSlaSettings", () => ({
  getSlaHours: vi.fn(),
  slaDueDateFromSettings: vi.fn(),
}));

const { parseSlaHoursInput } = await import("./ticketRoutes");

describe("parseSlaHoursInput", () => {
  it("rounds before validating, so a value like 0.4 is rejected instead of silently becoming 0", () => {
    // Regression test: the old code validated the raw ">0" value and only
    // rounded at the storage call, so 0.4 passed validation, rounded down to
    // 0, got written to a NOT NULL column, and getSlaHours()'s own
    // `row.hours > 0` guard then silently discarded it — the admin saw a 200
    // but the override never took effect.
    const result = parseSlaHoursInput({ HOT: 0.4 });
    expect(result).toEqual({ error: "HOT hours must be a positive number (up to 1 year)" });
  });

  it("rounds a fractional value that still rounds up to something valid", () => {
    const result = parseSlaHoursInput({ HOT: 1.6 });
    expect(result).toEqual({ entries: [{ priority: "HOT", hours: 2 }] });
  });

  it("accepts multiple priorities in one call", () => {
    const result = parseSlaHoursInput({ HOT: 4, WARM: 72.4, COLD: 200 });
    expect(result).toEqual({
      entries: [
        { priority: "HOT", hours: 4 },
        { priority: "WARM", hours: 72 },
        { priority: "COLD", hours: 200 },
      ],
    });
  });

  it("rejects when no recognised priority key is present", () => {
    const result = parseSlaHoursInput({ foo: 4 });
    expect(result).toEqual({ error: "No valid priority hours provided" });
  });

  it("rejects a negative or zero value", () => {
    expect(parseSlaHoursInput({ HOT: 0 })).toEqual({
      error: "HOT hours must be a positive number (up to 1 year)",
    });
    expect(parseSlaHoursInput({ HOT: -3 })).toEqual({
      error: "HOT hours must be a positive number (up to 1 year)",
    });
  });

  it("rejects a value beyond one year of hours", () => {
    const result = parseSlaHoursInput({ COLD: 24 * 365 + 1 });
    expect(result).toEqual({ error: "COLD hours must be a positive number (up to 1 year)" });
  });

  it("rejects a non-numeric value", () => {
    const result = parseSlaHoursInput({ HOT: "not-a-number" });
    expect(result).toEqual({ error: "HOT hours must be a positive number (up to 1 year)" });
  });

  it("ignores priorities that are not present in the body", () => {
    const result = parseSlaHoursInput({ HOT: 10, WARM: undefined });
    expect(result).toEqual({ entries: [{ priority: "HOT", hours: 10 }] });
  });
});
