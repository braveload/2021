# 불빛 뒤집기 통합 / 난이도별 25회 도전

2026-11-03. Base: ed3e88d. User authorized merging the duplicate game into existing Lights Out with selectable challenge difficulty. Existing records and saved games must survive; deck-builder remains held.

## Plan
1. One engine: unlimited free mode +25-move challenge, exact minimum-solution difficulty. Backwards-compatible state/record validation.
2. One home entry/name, mode/difficulty selector, unified read-only display of old records and separated new difficulty records. Legacy links still work.
3. Exhaustive difficulty/solution and version compatibility tests; local and production browser play/save/reload/legacy-data verification; deploy on existing service branch.

## Decisions
- Exact enumeration of all65,536 press patterns gives4096 reachable boards with minimum-distance histogram0:1,1:16,2:120,3:560,4:1387,5:1440,6:540,7:32. Challenge easy2–3, normal4–5, hard6–7;25 moves for every challenge.
- Difficulty measures solution length, not demonstrated human skill difficulty. Free mode has no move cap. Both modes use all lights off as the visible goal.
- Retain internal `reverse` storage/game ID and old bit encoding, but use public name 불빛 뒤집기 and canonical `game=lights` route. An internal1 means an off light on the unified screen. Legacy saved problems keep identical legal paths; no stored data conversion or overwrite on read.
- New lights rules1.1.0; code/dice remain1.0.0. Old reverse1.0.0 saves/records remain supported and are labeled previous unclassified25-move challenges, never retroactively assigned a level.
- Legacy `panludiq.lights.v1` stays byte-identical; old free successes displayed separately. New free/challenge/easy/normal/hard records are separated. No automatic record merging/regrading/deletion.

## Status
Implementation/local verification complete; production deployment pending. Use existing detached release checkout; preserve original private deck draft checkout/stash. No new services or dependencies.

## Local evidence and resume capsule
- Core1.1.0 lights plus backward-compatible1.0.0 validation; code/dice versions unchanged.
- All65,536 independent press patterns agree with solver minima.1,500 generated level puzzles solved and classified; unlimited free play beyond25,25th move win/loss and legacy formats tested.
- Browser tests pass: single home entry, canonical/legacy routes, mode/level changes, confirmation/cancel/Escape, reload with selected level, all levels completed, legal25th-move success/failure, mode-separated history, old raw records retained, mobile390/320 widths.
- Full existing engine and browser regression tests pass, including code/dice save/restore and original baseball.
- Production pre-deploy test browser contains a real old1.0.0 reverse game with one move and three completed records. Raw browser state saved locally for post-deploy comparison. Existing free records/other game sessions/profile/audio included.
- Next: push verified change to existing auto-deploy branch, wait live, replay old progress and verify free/all3levels and preservation. Rollback to ed3e88d if old data stops loading or gameplay fails. No clearing/migration of storage.

## Production completion
- Product commit5efad880806853d19cb5b937080cb2e2b731d9b0; Render deploydep-dbkto17lk1mc73ea8sbg became live2026-11-03 22:05:28 KST.
- Actual pre-update production save1.0.0 with one move restored unchanged through the old URL, normalized togame=lights, then solved. Three original completion records preserved exactly; new legacy completion/free/three-level wins appended, total8 with no duplicate on reload.
- Isolated production browser tests passed for unlimited free mode beyond25, all levels, mode/difficulty confirmation and cancellation, persistent settings, legal25th-move success/failure, separated records and legacy-format retention,390/320px widths. Existing code/dice/legacy baseball browser suite also passed.
- Public11files match sources. Existing engine/profile/audio/online scripts retained. Deck-builder remains absent/held.
- Evidence under chat visualization: lights-upgrade/upgrade-results.json and asset-results.json; lights-production/lights-results.json and browser-results.json; screenshots stored alongside.
- Documentation-only follow-up uses[skip render]. No further product deployment needed. Physical phones, screen readers and subjective difficulty remain unverified.
