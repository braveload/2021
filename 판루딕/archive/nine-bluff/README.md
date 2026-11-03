# Nine Bluff: preserved, not published

Retain the old game for a later redesign while keeping it absent from the website. No replacement rules are implemented.

Source commit: 59541082396c80fef4c788715a168b07848712c5.

- app.original.js is a byte-identical snapshot of the original dist/app.js. It preserves Nine Bluff rules/configuration, difficulty selection, initialization, chooseAI, nineRound, selectNine, revealNine, nineFinish, UI templates and record flow. Other baseline functions remain for context.
- engine.original.js is a byte-identical snapshot of original dist/engine.js, including bluff scoring.
- Original bluff scoring and its original assertions are also restored in the current engine/tests. This alone does not expose a playable game.
- Original Nine Bluff artwork and CSS remain in their existing locations.

The archive is outside dist and excluded from build-render.cjs output. No HTML import, public page, link, game-list entry, rules entry or start route exposes it. The active game allowlist excludes nine.

Existing nine rows in panludiq.records.v1 remain readable internally and survive normal saves. They are filtered from the records screen. Clearing displayed records retains these hidden rows. No automatic migration or browser-data deletion runs.

Future reinstatement needs separately approved game design and entry changes. Do not load the baseline snapshot over the current app: it would replace other approved UX/game changes.
