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

Production outcome: pending deployment; append the final deploy/verification evidence after completion.
