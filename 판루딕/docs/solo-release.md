# Solo three-game release

2026-11-03 (Asia/Seoul). User explicitly authorized production deployment of Code Breaker, Reverse Tile and Dice Strategy, preserving all existing games/records and continuing the deck-builder hold.

## Target and source

- Confirmed workspace: 티거's workspace (`tea-d9ecssjtqb8s73a8nf50`).
- Existing Render static site: `panludiq`, service `srv-dbispkks728c7387c150`, https://panludiq.onrender.com.
- Git repository/branch: braveload/2021, `feat/solo-baseball-audio`; auto deploy on commit.
- Prior live source: `558a708837c9802f45319da60352f86f37b48f3f`, deploy `dep-dbks422vcj2c739rm8i0`.
- Release assembled on the prior live source in an existing clean checkout. Only verified three-game files were copied. Paused deck commit/UI remain in the original local checkout/stash; no deck engine/assets/tests/docs are included in this release tree.

## Pre-deploy validation

- `node '판루딕/build-render.cjs'`: full rules/legacy/online regression suite passes and publish assets prepared.
- Actual publish folder browser test: start, completion, records, refresh, deterministic resume, terminal dedupe, cross-tab sequential progress, corrupt/denied storage, keyboard and mobile widths all pass.
- Legacy engine, guest, sound, home artwork styles, mini engine and online scripts match prior source. Existing local-storage keys are unchanged.
- Dedicated production test browser played and completed existing baseball/lights games before deployment. Raw old record/profile/sound values and browser state are saved locally for byte-for-byte comparison after deployment. A legacy Nine Bluff fixture is also retained to verify hidden records survive. No personal browser data is edited.
- Deck assets absent from publish folder.

## Deploy and verification plan

Push one fast-forward release commit to the existing branch; let configured Render auto-deploy run without an extra manual trigger. Wait for that commit's deploy to become `live`, then check public assets and execute production browser play/save/restore tests using the pre-deploy browser state. Monitor for render/script failures. No online service configuration or restart.

Rollback trigger: missing/broken existing game, legacy-record mutation, new game unplayable, or new save/restore failure. Rollback is a forward revert of this isolated release commit to the prior live tree and deployment; browser records are never cleared.

## Production outcome

- Release commit: `0178834c6c58f06ee77b93a9e81b66656a563744`.
- Render deploy: `dep-dbkt9mqvcj2c739tddbg`, status `live`, finished 2026-11-03 21:34:49 KST.
- Public code/assets: 13 public files match release sources after line-ending normalization, including existing engines/profile/audio/online scripts. Paused `deck-engine.js` returns404.
- Dedicated pre/post deployment browser roundtrip passed: original baseball/lights records, hidden Nine fixture, guest and sound values remained byte-for-byte identical. New code/reverse/dice games completed, each restored mid-game via reload, three completion records remained exactly three after terminal reload/revisit.
- Actual sample outcomes (automated validation, not human playtimes): code900points/2attempts; reverse6moves/3stars; dice56points/9placements.
- Full production Chromium suite passed: input validation, success/failure, record dedupe, reverse solving, dice placement, sequential cross-tab progress, record links,390/320px layouts, keyboard, storage refusal/corruption handling.
- Existing online service `/health` returned `{ok:true}`; its deployment/configuration was not changed.
- Initial remote-browser checks needed an explicit wait for record-dialog navigation and a clean game tab before reloading the records deep-link. Test procedure was corrected; no product-source change or extra deploy was needed.
- Screenshots/results are local in this chat's visualization directory under `production-verification` and `production-browser`. They contain only isolated test-browser state. Actual personal browser storage was not accessed.

## Final handoff

Deployment and requested play/save/restore verification complete. Documentation/test-only follow-up uses `[skip render]`; live product commit remains0178834. Deck-builder remains held in the original local checkout/stash and absent from the release tree. Real physical phones and screen-reader certification remain untested. Existing local-only records still do not sync between devices. Do not clear or migrate old record keys.
