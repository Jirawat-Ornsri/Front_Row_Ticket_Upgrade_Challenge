import type { FanGroup, QueueMode, RankedEntry, TicketQueueEntry } from "./types";

export const scoringWeights = {
  waitingTime: 0.4,
  loyaltyPoints: 0.25,
  membership: 0.15,
  ticketValue: 0.1,
  recentUpgrades: 0.1,
} as const;

type ScoreInput = { entry: TicketQueueEntry; upgrades: number | null };
type Factor = "waitingTime" | "loyaltyPoints" | "ticketValue" | "recentUpgrades";

function normalize(values: number[], value: number): number {
  if (values.length === 0) return 0.5;
  let min = Infinity;
  let max = -Infinity;
  for (const candidate of values) { min = Math.min(min, candidate); max = Math.max(max, candidate); }
  return min === max ? 0.5 : (value - min) / (max - min);
}

function entryNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function waitMs(entry: TicketQueueEntry, now: Date): number {
  const joined = Date.parse(entry.joinedQueueAt);
  return Number.isFinite(joined) ? Math.max(0, now.getTime() - joined) : 0;
}

function compareRanked(a: RankedEntry, b: RankedEntry): number {
  const joinedA = Date.parse(a.entry.joinedQueueAt);
  const joinedB = Date.parse(b.entry.joinedQueueAt);
  return b.score - a.score
    || (Number.isFinite(joinedA) ? joinedA : Number.POSITIVE_INFINITY)
      - (Number.isFinite(joinedB) ? joinedB : Number.POSITIVE_INFINITY)
    || entryNumber(b.entry.loyaltyPoints) - entryNumber(a.entry.loyaltyPoints)
    || Date.parse(a.entry.joinedQueueAt) - Date.parse(b.entry.joinedQueueAt)
    || (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0);
}

export function scoreGroupRepresentatives(groups: FanGroup[], now: Date, mode: QueueMode = "default"): FanGroup[] {
  const inputs: ScoreInput[] = groups.flatMap((group) => {
    const hasUnknown = group.entries.some((entry) => entry.upgradesLast30Days == null
      || !Number.isFinite(entry.upgradesLast30Days));
    const upgrades = hasUnknown ? null : group.entries.reduce((sum, entry) => sum + entry.upgradesLast30Days!, 0);
    return group.entries.map((entry) => ({ entry, upgrades }));
  });
  const scoreInputByEntry = new Map(inputs.map((input) => [input.entry, input]));
  const values: Record<Factor, number[]> = {
    waitingTime: inputs.map(({ entry }) => waitMs(entry, now)),
    loyaltyPoints: inputs.map(({ entry }) => entryNumber(entry.loyaltyPoints)),
    ticketValue: inputs.map(({ entry }) => entryNumber(typeof entry.ticketValue === "string" ? Number(entry.ticketValue) : entry.ticketValue)),
    recentUpgrades: inputs.flatMap(({ upgrades }) => upgrades === null ? [] : [upgrades]),
  };

  return groups.map((group) => {
    const ranked = group.entries.map((entry): RankedEntry => {
      const source = scoreInputByEntry.get(entry)!;
      const components = {
        waitingTime: normalize(values.waitingTime, waitMs(entry, now)),
        loyaltyPoints: normalize(values.loyaltyPoints, entryNumber(entry.loyaltyPoints)),
        membership: entry.membership === "vip" ? 1 : 0,
        ticketValue: normalize(values.ticketValue, entryNumber(typeof entry.ticketValue === "string" ? Number(entry.ticketValue) : entry.ticketValue)),
        recentUpgrades: source.upgrades === null ? null : 1 - normalize(values.recentUpgrades, source.upgrades),
      };
      const weights: Record<keyof typeof scoringWeights, number> = { ...scoringWeights };
      if (mode === "rush-hour") { weights.waitingTime = 0.6; weights.loyaltyPoints = 0.05; }
      if (mode === "vip-hour") weights.membership = 0.25;
      if (mode === "fair-queue") weights.recentUpgrades = 0.25;
      const activeWeight = source.upgrades === null ? 1 - weights.recentUpgrades : 1;
      const score = Object.entries(components).reduce((sum, [factor, value]) => {
        if (value === null) return sum;
        return sum + value * weights[factor as keyof typeof weights] / activeWeight;
      }, 0) * 100;
      const reasons = [
        `Waiting ${formatDuration(waitMs(entry, now))}: ${points(components.waitingTime, weights.waitingTime, activeWeight)} points.`,
        `${entry.membership === "vip" ? "VIP membership bonus" : "Regular membership"}: ${points(components.membership, weights.membership, activeWeight)} points.`,
        `Loyalty ${entryNumber(entry.loyaltyPoints)} points: ${points(components.loyaltyPoints, weights.loyaltyPoints, activeWeight)} points.`,
        `Ticket value ${entry.ticketValue}: ${points(components.ticketValue, weights.ticketValue, activeWeight)} points.`,
        source.upgrades === null
          ? "Recent upgrades unknown (at least one group account has missing history); this factor is omitted and other weights are rescaled."
          : `${source.upgrades} recent upgrades across the group: ${points(components.recentUpgrades!, weights.recentUpgrades, activeWeight)} points.`,
      ];
      return { entry, score: Number(score.toFixed(6)), reasons };
    }).sort(compareRanked);
    return { ...group, representative: ranked[0] ?? null };
  });
}

function points(value: number, weight: number, activeWeight: number): string {
  return ((value * weight / activeWeight) * 100).toFixed(2);
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export function rankRepresentatives(groups: FanGroup[]): RankedEntry[] {
  return groups.flatMap(({ representative }) => representative ? [representative] : []).sort(compareRanked);
}
