import { describe, expect, it, vi, beforeEach } from "vitest";

const getTicketSlaSettings = vi.fn();

vi.mock("./storage", () => ({
  storage: {
    getTicketSlaSettings: (...args: unknown[]) => getTicketSlaSettings(...args),
  },
}));

const { getSlaHours, slaDueDateFromSettings } = await import("./ticketSlaSettings");

beforeEach(() => {
  getTicketSlaSettings.mockReset();
});

describe("getSlaHours", () => {
  it("falls back to the hardcoded defaults when no rows exist", async () => {
    getTicketSlaSettings.mockResolvedValue([]);
    expect(await getSlaHours()).toEqual({ HOT: 24, WARM: 72, COLD: 168 });
  });

  it("overrides only the priorities that have a row", async () => {
    getTicketSlaSettings.mockResolvedValue([{ priority: "HOT", hours: 4 }]);
    expect(await getSlaHours()).toEqual({ HOT: 4, WARM: 72, COLD: 168 });
  });

  it("ignores a zero or negative stored value and keeps the default", async () => {
    // getSlaHours's own row.hours > 0 guard is the last line of defence
    // against a bad row (e.g. one written before the PUT route rounded
    // before validating) silently taking effect.
    getTicketSlaSettings.mockResolvedValue([
      { priority: "HOT", hours: 0 },
      { priority: "WARM", hours: -5 },
    ]);
    expect(await getSlaHours()).toEqual({ HOT: 24, WARM: 72, COLD: 168 });
  });

  it("ignores a non-finite stored value and keeps the default", async () => {
    getTicketSlaSettings.mockResolvedValue([{ priority: "COLD", hours: NaN }]);
    expect(await getSlaHours()).toEqual({ HOT: 24, WARM: 72, COLD: 168 });
  });

  it("falls back to all defaults when the read throws", async () => {
    // A missing migration or a connection blip must degrade to the
    // hardcoded defaults, not propagate and break ticket writes.
    getTicketSlaSettings.mockRejectedValue(new Error("relation does not exist"));
    expect(await getSlaHours()).toEqual({ HOT: 24, WARM: 72, COLD: 168 });
  });
});

describe("slaDueDateFromSettings", () => {
  it("adds the merged hours (in ms) to the given from-date", async () => {
    getTicketSlaSettings.mockResolvedValue([{ priority: "HOT", hours: 2 }]);
    const from = new Date("2026-01-01T00:00:00.000Z");
    const due = await slaDueDateFromSettings("HOT", from);
    expect(due.toISOString()).toBe("2026-01-01T02:00:00.000Z");
  });
});
