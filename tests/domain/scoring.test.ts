import { describe, expect, it } from "vitest";
import { buildFrontRowUpgradeQueue } from "../../src/domain/queue";
import type { TicketQueueEntry } from "../../src/domain/types";

const now = new Date("2026-01-01T12:00:00.000Z");
function entry(id: string, overrides: Partial<TicketQueueEntry> = {}): TicketQueueEntry {
  return {
    id, fanId: id, fanName: id, ticketValue: 100,
    joinedQueueAt: "2026-01-01T10:00:00.000Z", eventStartsAt: "2026-01-02T12:00:00.000Z",
    status: "waiting", membership: "regular", loyaltyPoints: 0, upgradesLast30Days: 0,
    ...overrides,
  };
}

describe("buildFrontRowUpgradeQueue", () => {
  it("scores and ranks eligible representatives, preserving group entries", () => {
    const vip = entry("vip", { membership: "vip", fanId: "shared", phoneNumber: "p", loyaltyPoints: 100 });
    const regular = entry("regular", { fanId: "shared", phoneNumber: "p", loyaltyPoints: 0 });
    const other = entry("other", { joinedQueueAt: "2026-01-01T11:00:00Z" });
    const result = buildFrontRowUpgradeQueue([vip, regular, other], now);
    expect(result.fanGroups[0].entries).toEqual([vip, regular]);
    expect(result.fanGroups[0].representative?.entry.id).toBe("vip");
    expect(result.topCandidates.map(({ entry: candidate }) => candidate.id)).toEqual(["vip", "other"]);
    expect(result.winner).toEqual(result.topCandidates[0]);
    expect(result.fanGroups.flatMap(({ representative }) => representative ? [representative.entry.id] : [])).toHaveLength(2);
  });

  it("applies the configured contribution of each normalized factor", () => {
    const score = (items: TicketQueueEntry[], id: string) => buildFrontRowUpgradeQueue(items, now).rankedCandidates.find(({ entry: candidate }) => candidate.id === id)!.score;
    const paired = (a: Partial<TicketQueueEntry>, b: Partial<TicketQueueEntry>) => [entry("a", a), entry("b", b)];
    expect(score(paired({ joinedQueueAt: "2026-01-01T10:00:00Z" }, { joinedQueueAt: "2026-01-01T11:00:00Z" }), "a") - score(paired({ joinedQueueAt: "2026-01-01T10:00:00Z" }, { joinedQueueAt: "2026-01-01T11:00:00Z" }), "b")).toBe(40);
    expect(score(paired({ membership: "vip" }, { membership: "regular" }), "a") - score(paired({ membership: "vip" }, { membership: "regular" }), "b")).toBe(15);
    expect(score(paired({ loyaltyPoints: 100 }, { loyaltyPoints: 0 }), "a") - score(paired({ loyaltyPoints: 100 }, { loyaltyPoints: 0 }), "b")).toBe(25);
    expect(score(paired({ ticketValue: 200 }, { ticketValue: 100 }), "a") - score(paired({ ticketValue: 200 }, { ticketValue: 100 }), "b")).toBe(10);
    expect(score(paired({ upgradesLast30Days: 0 }, { upgradesLast30Days: 5 }), "a") - score(paired({ upgradesLast30Days: 0 }, { upgradesLast30Days: 5 }), "b")).toBe(10);
  });

  it("uses aggregated upgrades, treating any missing group value as unknown", () => {
    const knownA = entry("a", { phoneNumber: "p", upgradesLast30Days: 2 });
    const knownB = entry("b", { phoneNumber: "p", upgradesLast30Days: 3 });
    const known = buildFrontRowUpgradeQueue([knownA, knownB, entry("none", { upgradesLast30Days: 0 })], now);
    expect(known.fanGroups[0].representative?.reasons.join(" ")).toContain("5 recent upgrades");
    const missing = buildFrontRowUpgradeQueue([entry("unknown", { upgradesLast30Days: null }), entry("known", { upgradesLast30Days: 0 })], now);
    expect(missing.topCandidates.find(({ entry: e }) => e.id === "unknown")?.reasons.join(" ")).toContain("unknown");
  });

  it("is deterministic, does not mutate inputs, and returns no winner for no eligible entries", () => {
    const input = [entry("b", { phoneNumber: "p" }), entry("a", { phoneNumber: "p" }), entry("blocked", { membership: "blocked" })];
    const before = structuredClone(input);
    expect(buildFrontRowUpgradeQueue(input, now)).toEqual(buildFrontRowUpgradeQueue(input, now));
    expect(input).toEqual(before);
    expect(buildFrontRowUpgradeQueue([entry("blocked", { membership: "blocked" })], now)).toMatchObject({ winner: null, topCandidates: [], fanGroups: [] });
  });

  it("breaks exact score ties by wait, loyalty, join time, then lexical ID", () => {
    const result = buildFrontRowUpgradeQueue([
      entry("z", { joinedQueueAt: "2026-01-01T10:00:00Z" }),
      entry("a", { joinedQueueAt: "2026-01-01T10:00:00Z" }),
    ], now);
    expect(result.winner?.entry.id).toBe("a");
  });

  it("keeps default identical and gives Rush Hour a larger waiting-time weight", () => {
    const input = [entry("old", { joinedQueueAt: "2026-01-01T10:00:00Z" }), entry("new", { joinedQueueAt: "2026-01-01T11:00:00Z" })];
    expect(buildFrontRowUpgradeQueue(input, now, "default")).toEqual(buildFrontRowUpgradeQueue(input, now));
    expect(buildFrontRowUpgradeQueue(input, now, "rush-hour").rankedCandidates[0].score - buildFrontRowUpgradeQueue(input, now, "rush-hour").rankedCandidates[1].score).toBe(60);
  });

  it("boosts VIP modestly in VIP Hour without making VIP a guaranteed winner", () => {
    const vip = entry("vip", { membership: "vip", loyaltyPoints: 0 });
    const regular = entry("regular", { membership: "regular", loyaltyPoints: 100 });
    const result = buildFrontRowUpgradeQueue([vip, regular], now, "vip-hour");
    expect(result.rankedCandidates[0].entry.id).toBe("regular");
    expect(result.rankedCandidates.find(({ entry: e }) => e.id === "vip")?.score).toBeGreaterThan(buildFrontRowUpgradeQueue([vip, regular], now).rankedCandidates.find(({ entry: e }) => e.id === "vip")?.score ?? 0);
  });

  it("increases known upgrade penalties and preserves unknown histories in Fair Queue Mode", () => {
    const input = [entry("clean", { upgradesLast30Days: 0 }), entry("upgraded", { upgradesLast30Days: 5 })];
    const fair = buildFrontRowUpgradeQueue(input, now, "fair-queue");
    expect(fair.rankedCandidates.find(({ entry: e }) => e.id === "clean")!.score - fair.rankedCandidates.find(({ entry: e }) => e.id === "upgraded")!.score).toBeGreaterThan(buildFrontRowUpgradeQueue(input, now).rankedCandidates.find(({ entry: e }) => e.id === "clean")!.score - buildFrontRowUpgradeQueue(input, now).rankedCandidates.find(({ entry: e }) => e.id === "upgraded")!.score);
    const unknown = buildFrontRowUpgradeQueue([entry("x", { upgradesLast30Days: null }), entry("y", { upgradesLast30Days: 3 })], now, "fair-queue");
    expect(unknown.rankedCandidates[0].reasons.join(" ")).toContain("unknown");
  });

  it("does not mutate inputs and is deterministic for each mode", () => {
    const input = [entry("a", { upgradesLast30Days: 1 }), entry("b", { membership: "vip", upgradesLast30Days: 2 })];
    const before = structuredClone(input);
    for (const mode of ["default", "rush-hour", "vip-hour", "fair-queue"] as const) expect(buildFrontRowUpgradeQueue(input, now, mode)).toEqual(buildFrontRowUpgradeQueue(input, now, mode));
    expect(input).toEqual(before);
  });
});
