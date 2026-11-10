# Front Row Ticket Upgrade Queue

## Project overview

A small interactive queue dashboard that identifies eligible ticket holders for a front row upgrade, groups accounts linked by shared identifiers, scores one representative per group, and explains the decision. This documents the current implementation and its design assumptions; the original assignment PDF was not available for cross-checking.

## Technology stack

- Next.js App Router and React
- TypeScript
- CSS
- Vitest

No additional runtime libraries are used beyond Next.js and React.

## Getting started

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Next.js. Other package scripts are `npm test`, `npm run typecheck`, `npm run build`, and `npm start` (serve a production build). There is no lint script configured.

## Processing pipeline

1. **Eligibility:** cancelled or already upgraded entries, entries whose event has started, blocked memberships, invalid event times, and non-positive or invalid ticket values are excluded with a reason. The check uses that priority order.
2. **Fan grouping:** eligible entries are connected when they share a normalized phone number, trimmed device ID, or trimmed payment account. Connected components include indirect/transitive links.
3. **Account scoring:** numeric factors are normalized across eligible entries, while each account in a group uses that group's aggregated recent upgrade count.
4. **Representative selection:** the highest-scoring account in each group represents the group. Group members remain visible; only representatives enter the global ranking.
5. **Winner selection:** representatives are sorted, the first is the winner, and up to three are shown as top candidates. No eligible accounts yields an empty winner state.

## Scoring formula

For an account with known group upgrade history, the score is `100 × (0.40W + 0.25L + 0.15M + 0.10T + 0.10U)`, where each factor is in `[0,1]`:

- **W, waiting time (40%):** elapsed time from queue join to the simulated current time; future and invalid join dates become zero. Min-max normalized across eligible accounts.
- **L, loyalty points (25%):** min-max normalized across eligible accounts; missing, null, or non-finite values are treated as zero.
- **M, membership (15%):** VIP is 1; other eligible membership values are 0.
- **T, ticket value (10%):** min-max normalized across eligible accounts.
- **U, recent upgrades (10%):** the inverse min-max normalized count of upgrades in the last 30 days aggregated across all group accounts. More upgrades lower the score.

Min-max normalization is `(x − min)/(max − min)`. If a factor has a constant range, every entry receives `0.5`. Ticket values can be numeric strings; eligibility validates them as positive finite numbers. A malformed join date contributes zero wait.

If any account in a fan group has missing, null, or non-finite upgrade history, that group's upgrade total is unknown. The upgrade factor is omitted for that group and all remaining weights are divided by `0.90`, so the remaining factors again sum to 100%. This is a conservative data-handling assumption, not proof that the group has no upgrades.

## Representative selection and fairness

Only one representative per connected group is ranked, so a group does not receive multiple slots merely by having more linked accounts. The representative is the group's highest-scoring account; its score includes the group's aggregate upgrade history. This limits account-count advantage in the ranking, but grouping depends on the available identifiers and does not establish that all linked accounts belong to one person.

## Deterministic tie-breaking

Descending score, then earlier queue join time, then higher loyalty points, then earlier queue join time again, then lexical entry ID ascending. The comparator repeats the earlier-join comparison; after the first comparison this normally has no effect. Invalid join dates sort after valid dates in the first date comparison; the later comparison uses parsed dates directly. Entry IDs are the final deterministic tie-breaker.

## Fan grouping algorithm and complexity

Grouping uses Disjoint Set Union (Union-Find) with path compression and union by size. A hash map tracks the first entry for each field-qualified identifier; each subsequent match unions with that owner. With at most three identifiers per entry, expected grouping time is approximately `O(n α(n))` and memory is `O(n + k)`, where `k` is the number of distinct identifiers/connections. Scoring now uses a map for per-entry group history lookup and linear cohort normalization; representative ranking requires sorting and is `O(g log g)` for `g` groups. No 500,000-entry benchmark has been run.

## Known limitations and assumptions

- Phone normalization removes whitespace, parentheses, periods, and hyphens; it does not canonicalize country codes or other punctuation. Device and payment identifiers are case-sensitive after trimming.
- The input is mock in-memory data. Loyalty edits and simulated time changes persist only in the current browser session; there is no backend or durable storage.
- Duplicate or synchronized upgrade-history records cannot be detected and may inflate a group's total. A missing history value makes the whole group total unknown.
- Invalid join dates are not excluded; they receive zero waiting time. Invalid event dates are excluded.
- Large-data performance has not been measured, and the dashboard renders group entries in the client.
- The task requirements here were established from the project conversation; the original assignment PDF was unavailable for verification.

## Potentially unfair outcome

A VIP entrant with high loyalty can beat a long-waiting regular entrant because VIP status and loyalty contribute 40% combined, while waiting contributes 40% and is normalized relative to the current cohort. Changes in the cohort can shift normalized scores even when an individual account's data stays fixed.

## Queue modes

The selector activates exactly one mode at a time and starts in **Default**. Default preserves the formula and weights above. **Rush Hour** changes waiting-time weight to 60% and loyalty to 5% (other weights unchanged), increasing the effect of waiting. **VIP Hour** raises VIP membership weight from 15% to 25%, giving VIP accounts a modest boost without guaranteeing the win. **Fair Queue Mode** raises the recent-upgrades weight from 10% to 25%, increasing the penalty based on group-level upgrade totals. When upgrade history is unknown, that factor remains omitted and the other mode weights are rescaled; unknown is never treated as zero.

## Future improvements

- Add a representative benchmark at 100,000 and 500,000 entries and profile client rendering before choosing virtualization or other optimizations.
- Validate and reconcile upgrade-history data upstream, including duplicate detection and an explicit policy for unknown histories.
