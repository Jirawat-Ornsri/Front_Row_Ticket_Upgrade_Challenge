import type { ExcludedEntry, TicketQueueEntry } from "./types";

/**
 * Exclusion priority: cancelled, upgraded, invalid current time, invalid event
 * time, started event, blocked membership, then invalid ticket value.
 * Invalid dates are excluded because eligibility cannot be established safely.
 */
export function getExclusionReason(entry: TicketQueueEntry, now: Date): string | null {
  if (entry.status === "cancelled") return "Entry is cancelled.";
  if (entry.status === "upgraded") return "Entry has already been upgraded.";
  if (!Number.isFinite(now.getTime())) return "Current time is invalid.";

  const eventStartsAt = Date.parse(entry.eventStartsAt);
  if (!Number.isFinite(eventStartsAt)) return "Event start time is invalid.";
  if (eventStartsAt <= now.getTime()) return "Concert has already started.";
  if (entry.membership === "blocked") return "Membership is blocked.";

  const ticketValue = typeof entry.ticketValue === "string"
    ? Number(entry.ticketValue.trim())
    : entry.ticketValue;
  if (typeof ticketValue !== "number" || !Number.isFinite(ticketValue) || ticketValue <= 0) {
    return "Ticket value must be a positive number.";
  }

  return null;
}

export function filterEligibleEntries(
  entries: TicketQueueEntry[],
  now: Date,
): { eligibleEntries: TicketQueueEntry[]; excludedEntries: ExcludedEntry[] } {
  const eligibleEntries: TicketQueueEntry[] = [];
  const excludedEntries: ExcludedEntry[] = [];

  for (const entry of entries) {
    const reason = getExclusionReason(entry, now);
    if (reason) excludedEntries.push({ entry, reason });
    else eligibleEntries.push(entry);
  }

  return { eligibleEntries, excludedEntries };
}
