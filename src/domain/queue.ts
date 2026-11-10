import { filterEligibleEntries } from "./eligibility";
import { groupEligibleEntries } from "./grouping";
import { rankRepresentatives, scoreGroupRepresentatives } from "./scoring";
import type { FrontRowUpgradeResult } from "./types";
import type { QueueMode } from "./types";

export function buildFrontRowUpgradeQueue(entries: Parameters<typeof filterEligibleEntries>[0], now: Date, mode: QueueMode = "default"): FrontRowUpgradeResult {
  const { eligibleEntries, excludedEntries } = filterEligibleEntries(entries, now);
  const fanGroups = scoreGroupRepresentatives(groupEligibleEntries(eligibleEntries), now, mode);
  const rankedCandidates = rankRepresentatives(fanGroups);
  return {
    winner: rankedCandidates[0] ?? null,
    fanGroups,
    excludedEntries,
    rankedCandidates,
    topCandidates: rankedCandidates.slice(0, 3),
  };
}
