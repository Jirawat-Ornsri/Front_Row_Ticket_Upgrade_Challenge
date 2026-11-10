import { filterEligibleEntries } from "./eligibility";
import { groupEligibleEntries } from "./grouping";
import { rankRepresentatives, scoreGroupRepresentatives } from "./scoring";
import type { FrontRowUpgradeResult } from "./types";

export function buildFrontRowUpgradeQueue(entries: Parameters<typeof filterEligibleEntries>[0], now: Date): FrontRowUpgradeResult {
  const { eligibleEntries, excludedEntries } = filterEligibleEntries(entries, now);
  const fanGroups = scoreGroupRepresentatives(groupEligibleEntries(eligibleEntries), now);
  const rankedCandidates = rankRepresentatives(fanGroups);
  return {
    winner: rankedCandidates[0] ?? null,
    fanGroups,
    excludedEntries,
    rankedCandidates,
    topCandidates: rankedCandidates.slice(0, 3),
  };
}
