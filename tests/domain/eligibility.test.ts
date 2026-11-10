import { describe, expect, it } from "vitest";
import { filterEligibleEntries, getExclusionReason } from "../../src/domain/eligibility";
import type { TicketQueueEntry } from "../../src/domain/types";

const now = new Date("2026-01-01T12:00:00.000Z");

function entry(overrides: Partial<TicketQueueEntry> = {}): TicketQueueEntry {
  return {
    id: "entry-1",
    fanId: "fan-1",
    fanName: "Fan One",
    ticketValue: 100,
    joinedQueueAt: "2026-01-01T10:00:00.000Z",
    eventStartsAt: "2026-01-02T12:00:00.000Z",
    status: "waiting",
    membership: "regular",
    ...overrides,
  };
}

describe("filterEligibleEntries", () => {
  it("keeps a valid waiting entry eligible", () => {
    const valid = entry();
    expect(filterEligibleEntries([valid], now)).toEqual({
      eligibleEntries: [valid],
      excludedEntries: [],
    });
  });

  it.each([
    ["cancelled status", { status: "cancelled" as const }, "Entry is cancelled."],
    ["upgraded status", { status: "upgraded" as const }, "Entry has already been upgraded."],
    ["started concert", { eventStartsAt: "2026-01-01T12:00:00.000Z" }, "Concert has already started."],
    ["blocked member", { membership: "blocked" as const }, "Membership is blocked."],
    ["null ticket value", { ticketValue: null }, "Ticket value must be a positive number."],
    ["empty ticket value", { ticketValue: "" }, "Ticket value must be a positive number."],
    ["whitespace ticket value", { ticketValue: "  \t" }, "Ticket value must be a positive number."],
    ["non-numeric ticket value", { ticketValue: "not-a-number" }, "Ticket value must be a positive number."],
    ["zero ticket value", { ticketValue: 0 }, "Ticket value must be a positive number."],
    ["negative ticket value", { ticketValue: -1 }, "Ticket value must be a positive number."],
  ])("excludes an entry with %s", (_label, overrides, reason) => {
    const invalid = entry(overrides);
    expect(filterEligibleEntries([invalid], now).excludedEntries).toEqual([{ entry: invalid, reason }]);
  });

  it("accepts a numeric string ticket value", () => {
    expect(filterEligibleEntries([entry({ ticketValue: "25.50" })], now).eligibleEntries).toHaveLength(1);
  });

  it("keeps an entry for a future concert eligible", () => {
    expect(filterEligibleEntries([entry({ eventStartsAt: "2026-01-01T12:00:00.001Z" })], now).eligibleEntries).toHaveLength(1);
  });

  it("uses the documented reason priority when multiple conditions apply", () => {
    const invalid = entry({ status: "cancelled", membership: "blocked", ticketValue: null });
    expect(getExclusionReason(invalid, now)).toBe("Entry is cancelled.");
  });

  it("excludes entries with invalid event dates", () => {
    const invalid = entry({ eventStartsAt: "not-a-date" });
    expect(getExclusionReason(invalid, now)).toBe("Event start time is invalid." );
  });

  it("does not mutate entries or their fields", () => {
    const original = entry({ ticketValue: "100" });
    const before = { ...original };
    filterEligibleEntries([original, entry({ ticketValue: "bad" })], now);
    expect(original).toEqual(before);
  });
});
