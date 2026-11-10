import { describe, expect, it } from "vitest";
import { groupEligibleEntries } from "../../src/domain/grouping";
import type { TicketQueueEntry } from "../../src/domain/types";

function entry(id: string, overrides: Partial<TicketQueueEntry> = {}): TicketQueueEntry {
  return {
    id,
    fanId: `fan-${id}`,
    fanName: `Fan ${id}`,
    ticketValue: 100,
    joinedQueueAt: "2026-01-01T10:00:00.000Z",
    eventStartsAt: "2026-01-02T12:00:00.000Z",
    status: "waiting",
    ...overrides,
  };
}

const groupIds = (entries: TicketQueueEntry[]) => groupEligibleEntries(entries).map((group) => group.entries.map(({ id }) => id));

describe("groupEligibleEntries", () => {
  it("groups entries that share a phone number", () => {
    expect(groupIds([entry("a", { phoneNumber: "0812345678" }), entry("b", { phoneNumber: "0812345678" })])).toEqual([["a", "b"]]);
  });

  it("normalizes phone formatting", () => {
    expect(groupIds([entry("a", { phoneNumber: "081-234-5678" }), entry("b", { phoneNumber: "081 234 5678" }), entry("c", { phoneNumber: "0812345678" })])).toEqual([["a", "b", "c"]]);
  });

  it("groups entries that share a device ID", () => {
    expect(groupIds([entry("a", { deviceId: "device-1" }), entry("b", { deviceId: "device-1" })])).toEqual([["a", "b"]]);
  });

  it("groups entries that share a payment account", () => {
    expect(groupIds([entry("a", { paymentAccount: "account-1" }), entry("b", { paymentAccount: "account-1" })])).toEqual([["a", "b"]]);
  });

  it("does not connect entries with missing or whitespace identifiers", () => {
    expect(groupIds([
      entry("a", { phoneNumber: "  - ", deviceId: "\t", paymentAccount: "" }),
      entry("b", { phoneNumber: null, deviceId: undefined, paymentAccount: "   " }),
    ])).toEqual([["a"], ["b"]]);
  });

  it("connects entries transitively across different fields", () => {
    expect(groupIds([
      entry("a", { phoneNumber: "0812345678" }),
      entry("b", { phoneNumber: "0812345678", deviceId: "device-1" }),
      entry("c", { deviceId: "device-1" }),
    ])).toEqual([["a", "b", "c"]]);
  });

  it("keeps an unshared entry in its own group", () => {
    expect(groupIds([entry("a", { phoneNumber: "0812345678" }), entry("b", { deviceId: "private" })])).toEqual([["a"], ["b"]]);
  });

  it("creates multiple independent groups", () => {
    expect(groupIds([
      entry("c", { phoneNumber: "3" }), entry("a", { phoneNumber: "1" }),
      entry("d", { phoneNumber: "3" }), entry("b", { phoneNumber: "1" }),
    ])).toEqual([["c", "d"], ["a", "b"]]);
  });

  it("does not duplicate an entry when it repeats an identifier", () => {
    const groups = groupEligibleEntries([
      entry("a", { phoneNumber: "0812345678", deviceId: "device-1" }),
      entry("b", { phoneNumber: "0812345678", deviceId: "device-1" }),
    ]);
    expect(groups[0].entries.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(groups[0].connectionReasons).toHaveLength(2);
  });

  it("returns deterministic IDs, group order, entry order, and reasons", () => {
    const input = [entry("b", { deviceId: "d" }), entry("a", { deviceId: "d" }), entry("z")];
    expect(groupEligibleEntries(input)).toEqual(groupEligibleEntries(input));
  });

  it("does not mutate the input entries", () => {
    const input = [entry("b", { phoneNumber: "081-234-5678" }), entry("a", { phoneNumber: "081 234 5678" })];
    const before = structuredClone(input);
    groupEligibleEntries(input);
    expect(input).toEqual(before);
  });

  it("explains shared fields and involved entries without exposing values", () => {
    const group = groupEligibleEntries([entry("a", { phoneNumber: "secret-number" }), entry("b", { phoneNumber: "secret-number" })])[0];
    expect(group.connectionReasons).toHaveLength(1);
    expect(group.connectionReasons[0]).toContain("phone number");
    expect(group.connectionReasons[0]).toContain("a");
    expect(group.connectionReasons[0]).toContain("b");
    expect(group.connectionReasons[0]).not.toContain("secret-number");
  });

  it("treats device IDs and payment accounts as case-sensitive after trimming", () => {
    expect(groupIds([
      entry("a", { deviceId: "Device" }), entry("b", { deviceId: "device" }),
      entry("c", { paymentAccount: "Pay" }), entry("d", { paymentAccount: "pay" }),
      entry("e", { deviceId: " device " }), entry("f", { deviceId: "device" }),
    ])).toEqual([["a"], ["b", "e", "f"], ["c"], ["d"]]);
  });
});

