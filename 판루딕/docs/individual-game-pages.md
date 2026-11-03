# 게임별 전용 페이지

2026-11-03. User identified inconsistent presentation: legacy games open individual popups, while new games opened a shared page with three game-switching tabs and sometimes a previous completion result. User explicitly accepted the standalone-page alternative provided each game has its own page.

## Scope
- Dedicated `code-breaker.html`, `lights.html`, `dice-strategy.html`; no shared game tabs on these pages. Original baseball/triple/memory popups remain unchanged.
- Shared rules/core/store retained; no rule, difficulty or record-schema changes.
- Home links use dedicated pages. Old `solo.html?game=...` links redirect, preserving records deep links.
- Opening a completed game afresh starts a new attempt while keeping its completion record. In-progress games resume unchanged. Reloading a result keeps it without duplicating records. Record-only deep links do not start a new attempt.
- Existing unfinished/completed records and old light modes are preserved. Deck-builder remains held.

## Validation plan
Full engine regressions, independent-page title/URL/no-tabs, home entry/return, in-progress reload/revisit, completed fresh-open vs reload, record deep-link consumption, all games and light difficulty controls, desktop/mobile screenshots. Deploy verified change on existing Render branch and verify public routes and preservation.

Status: implementation and local verification complete; deployment pending.

## Local verification / resume capsule
- Shared core/store, game versions, rules and record schemas unchanged.
- Three dedicated pages, home links and legacy route redirect implemented; old individual popups remain unchanged.
- Fresh opens of completed runs retry their history write before starting a new run. If storage fails, retain the result instead of silently replacing it. In-progress state and result reload are preserved.
- Full engine verification and foundation/lights browser regressions pass.
- `individual-browser-tests.cjs` passes: original three popups, correct dedicated URLs/no tabs, all three completion/new-open/reload behaviors, mode preservation, legacy redirects, one-shot records deep link and390/320px layouts.
- Screenshots reviewed locally. A dedicated production test browser has unfinished snapshots of all three games and three old completion records saved before deployment.
- Next: deploy on existing auto-deploy branch and verify raw progress/records survive across the URL change, complete all three games and reopen to fresh boards. No deck-builder assets or code enabled.
