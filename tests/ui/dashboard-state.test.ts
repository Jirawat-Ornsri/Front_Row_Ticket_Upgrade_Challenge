import { describe, expect, it } from "vitest";
import { mockEntries } from "../../src/data/mockEntries";
import { buildFrontRowUpgradeQueue } from "../../src/domain/queue";
import type { TicketQueueEntry } from "../../src/domain/types";

describe("dashboard queue state", () => {
  const now = new Date("2026-11-10T10:00:00+07:00");

  it("derives a winner and exposes group connections and exclusions", () => {
    const result = buildFrontRowUpgradeQueue(mockEntries, now);
    expect(result.winner?.entry.fanName).toBe("Maya Chen");
    expect(result.topCandidates).toHaveLength(3);
    expect(result.fanGroups[0].connectionReasons.join(" ")).toContain("phone number");
    expect(result.excludedEntries.map(({ reason }) => reason)).toContain("Entry is cancelled.");
    expect(result.excludedEntries.map(({ reason }) => reason)).toContain("Membership is blocked.");
  });

  it("recalculates for advanced time and edited loyalty points without mutating mock data", () => {
    const before = structuredClone(mockEntries);
    const sessionEntries: TicketQueueEntry[] = mockEntries.map((entry) => ({ ...entry }));
    const initial = buildFrontRowUpgradeQueue(sessionEntries, now);
    const advanced = buildFrontRowUpgradeQueue(sessionEntries, new Date(now.getTime() + 10 * 60 * 60_000));
    expect(advanced.winner).toBeNull();
    expect(advanced.excludedEntries).toHaveLength(sessionEntries.length);

    const edited = sessionEntries.map((entry) => entry.id === "Q-2081" ? { ...entry, loyaltyPoints: 10_000 } : entry);
    const recalculated = buildFrontRowUpgradeQueue(edited, now);
    expect(recalculated.rankedCandidates[0].entry.id).not.toBe(initial.rankedCandidates[0].entry.id);
    expect(mockEntries).toEqual(before);
  });

  it("returns an empty winner when every entry is excluded", () => {
    const result = buildFrontRowUpgradeQueue(mockEntries.map((entry) => ({ ...entry, status: "cancelled" })), now);
    expect(result.winner).toBeNull();
    expect(result.fanGroups).toEqual([]);
    expect(result.excludedEntries).toHaveLength(mockEntries.length);
  });
});
