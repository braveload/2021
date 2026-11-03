# Solo foundation: Code Breaker / Reverse Tile / Dice Strategy

Date: 2026-11-03 (Asia/Seoul). Scope: local development and verification, no push/deployment.
Existing branch reused: `feat/solo-baseball-audio`; starting commit `c5342a5` contains preserved, unpublished deck-builder engine. Deck-builder UI remains stashed and is not enabled. Existing baseball/lights games, their records, online chess and current home artwork remain intact.

## Trace plan

1. Shared engine registry: create, legal actions, apply, result, validation; seeded state. Shared browser storage: per-game sessions, versioned completion records, deduplication, error feedback.
2. Shared play/records page, three game-specific boards, home entries, explicit rules and mobile/keyboard controls.
3. Boundary/property tests, storage tests, existing regression suite, browser start/finish/resume/history tests at mobile and desktop sizes. Commit phases locally only. Record test evidence and resume capsule before ending.

## Rules

- Code Breaker: four distinct digits from 0–7, leading zero allowed, eight valid attempts. Exact positions and misplaced digits only; invalid/repeated guesses do not consume attempts. Success score 1000−100×(attempts−1), failure0. No hints/time limit.
- Reverse Tile: 4×4; selected cell and orthogonal neighbors toggle. Goal all light. Generate by legal toggles from solved state and reject solved/trivial starts. Success checked before move25 failure. Stars10/16/25 as provisional thresholds; no hints/undo in this first version. New game discards current session only after confirmation.
- Dice Strategy: two independent d6 each turn (duplicates allowed), choose one and place in an empty3×3 cell. Nine placements. Base sum; complete rows sum10–14 +10; complete columns all distinct +8; each complete uniform-parity diagonal +6. Partial lines earn no bonus. Before placement selection can change, after placement no undo/reroll. No grades before calibration.

## Architecture

`solo-core.js`: pure serializable rules independent of DOM/storage, one interface for three games. `solo-store.js`: injected storage adapter, version-aware validation, session/record separation and idempotent terminal writes. `solo-ui.js`: common lifecycle/render shell, game-specific inputs only; all judgments delegated to core.
Sessions and history use new `panludiq.solo.*` keys. Legacy records are not migrated, overwritten or cleared. Restore RNG and selection with the session; loading must not roll dice or regenerate puzzles. Invalid new records are filtered and an invalid raw history is backed up before replacement. Unsupported rule versions are rejected. Browser records are device-local, not authenticated scores or public rankings.

## Phase status

- Engine/storage: complete. `node foundation-tests.cjs` passed, including exhaustive reverse reachability, generated solutions, code boundaries, dice deterministic replay and storage corruption/denial tests.
- UI/browser: complete. Separate `solo.html?game=code|reverse|dice` shares lifecycle, dialogs and records. Homepage has three new entries and an explicit records link. Existing games are preserved.
- Validation/release report: local verification complete; see `solo-validation.md`. No release/push/deployment.

## Limits

No game-specific AI is needed. Difficulty, star thresholds, actual-device behavior and enjoyment remain unmeasured. This task does not revive deck-builder, change Nine Bluff or deploy to Render.

## Phase 1 resume capsule

Shared interface and versioned local storage are implemented in `solo-core.js` and `solo-store.js`. New tests: `foundation-tests.cjs`. Input states are immutable, invalid actions preserve state, terminal writes are deduplicated and legacy keys are untouched. Registry uses code/reverse/dice. Next: common browser page and home entries; full verification before local UI commit. No remote changes.

## Phase 2 resume capsule

Phase 1 commit: `59bbd56`. UI and browser test harness are complete. `solo-entry.js` appends three new native links after existing home games. `app.js` only gains a link to new records. `verify.cjs` accepts local query-string links and runs foundation tests. Common records retain latest100 and use per-game completion markers so restoring an evicted terminal session does not recreate old history. Corrupt data backups and failed-history retry are tested. No original records are migrated or deleted.

Browser evidence is local under the chat visualization directory, not published assets. Engine/boundary suite and Chromium start/finish/reload/history/cross-tab/storage/mobile flows passed. Mobile dice selector precedes the board and remains sticky during scroll. No screen-reader/real-device certification or balance claim. Next handoff: user review of local three-game build; deployment requires a new explicit request. Do not push current branch automatically: it also contains preserved unpublished deck engine commit `c5342a5`.


## Deployment authorization and release isolation
2026-11-03: user authorized deploying only code/reverse/dice, preserving existing games/records and keeping deck-builder held. Release prepared at prior live558a708 in a clean existing checkout, copying only the verified three-game files. Deck-engine files, deck tests, deck docs and deck UI are excluded; all paused work remains in its original local checkout. Existing feature branch will be advanced by one fast-forward release commit. Prior no-deployment notes above describe the local-development phase.
