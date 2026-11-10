# Project Checklist

- [x] 1. Project Setup & Domain Types
- [x] 2. Eligibility Filtering
- [x] 3. Fan Grouping (Union-Find)
- [x] 4. Scoring & Winner Selection
- [x] 5. UI & Interactive Features
- [x] 6. Tests, Performance & README

Task 6 complete: Rush Hour, VIP Hour, and Fair Queue Mode implemented and documented; 41 tests passed across 4 files; TypeScript type checking and production build passed. No 100,000–500,000-entry benchmark was run, and no lint script is configured. The production build regenerated `next-env.d.ts`.

## Task 4 Scoring Policy

- Per-account score is the weighted sum of normalized factors, scaled to 0–100: waiting time 40%, loyalty points 25%, membership 15%, ticket value 10%, and recent upgrades 10%.
- Waiting time is elapsed milliseconds from `joinedQueueAt` to the supplied `now`, clamped to zero for future or invalid join dates. Loyalty and ticket value are min–max normalized over eligible accounts; missing loyalty is treated as zero. VIP maps to 1 and regular membership to 0.
- Numeric factors use min–max normalization over eligible accounts. A constant cohort range maps to 0.5. Recent upgrades is inversely normalized so more upgrades reduce the score.
- A group's upgrade total is the sum across its accounts. If any account is missing/null, the group total is unknown; the upgrade factor is omitted and the other weights are rescaled proportionally to total 100%. This avoids treating unknown history as no upgrades.
- The representative is the group's highest scoring account using the group total as that account's upgrade factor. The group entries are retained. Duplicate or synchronized records cannot be identified reliably from the available fields and are not deduplicated.
- Representative ranking is descending score, then longer waiting time, more loyalty points, earlier join time, and lexical entry ID. `winner` is the first ranked representative, and `topCandidates` contains up to three.
