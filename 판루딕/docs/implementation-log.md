# Approved design and content-matched structured data

Date: 2026-11-06. Branch: codex/panludiq-design-schema. Base: 2f7a0a0.

## Plan
1. Apply approved reference blend to existing dist HTML/CSS, preserve logo, artwork, glass, nested cards, color strips, routes and storage logic.
2. Generate static page-specific JSON-LD; verify syntax, canonical URLs, entities, existing rules and visible content; run build and responsive/browser checks.
3. Fast-forward existing deployment branch feat/solo-baseball-audio after checks; observe Render deployment and inspect production assets/schema.

Only this feature branch and intended files are committed. Existing untracked panludiq-public is generated output and excluded.
Project is not in the available code graph; targeted source inspection is used. Existing static frontend and separate online server remain unchanged in architecture. Existing schema uses VideoGame rather than invented reviews to pursue app rich results. Three popup games are represented on home, not fictitious standalone routes. Legacy solo.html is a routing page and is noindexed.

## Phase status
- Implementation: complete. Static schema generator integrated into Render build; verification includes schema assertions.
- Local validation: PASS build-render.cjs, all six engine suites, schema tests (8 pages, 16 game nodes across pages), 28 browser layouts (actual widths 1440, 1102, 720, 320), no horizontal overflow, desktop rail boundaries, home popup rules and baseball entry. Layout evidence: design-schema-layouts.json.
- Deployment: LIVE, commit 57d9445ddfe9c58add1dbe90771c9045a46ad704, Render dep-dbmu158n74is73bgot90. Finished 2026-11-06 23:14 KST. Root URL and all 11 checked files return HTTP 200 and match deployed source after normalizing inter-tag whitespace. Canonical root and legacy noindex verified. Architecture remains static frontend plus unchanged online backend.

## Resume
Source is dist; scripts/structured-data.cjs is the structured-data source of truth. Run node scripts/structured-data.cjs and node schema-tests.cjs, then node verify.cjs. Deploy frontend service srv-dbispkks728c7387c150 only. Online service is separate and does not require a deployment.

## Production validation / phase 2
- Schema.org Validator: index.html (home graph including all nine games), code-breaker.html, chess.html, lights.html, number-chain.html, line-control.html, online.html each show 0 errors / 0 warnings. Dice URL and code-input attempts encountered the validator's own markup-processing error; do not report this as a pass or a site schema error. Dice JSON-LD syntax, required internal assertions, matching deployed source, and schema vocabulary shared with passing game pages were verified locally.
- Live home shows 8 game cards, 8 short descriptions, retained glass blur(5px), correct heading and static JSON-LD. Actual local-chess move B1 to A2 survives refresh with 1/100 move count. Home baseball rules dialog opens correctly. Online backend /health returns {ok:true}; online engine/HTTP tests passed pre-deploy; no online backend redeployment or production room creation was needed.
- CDN temporarily served the prior root and dice documents after deployment. Waited through the 300-second cache lifetime; both now contain schema/design. Initial raw source comparison differed by generator-inserted inter-tag whitespace only; normalized comparisons now all pass. No duplicate deployment was triggered.
- Browser viewport overrides in the extra live run returned an actual 1280px viewport despite requested sizes. Only claim those live observations at 1280px; the separate local 28-layout evidence records actual widths 1440, 1102, 720, 320. Physical mobile/Safari testing was not performed.
- Initial commit failed because author identity was unset; retried with existing repository author's identity as command-local configuration, then push succeeded. No global Git settings changed.
- Evidence: design-schema-layouts.json, design-schema-production.json, schema-validator-results.json and captured screenshots where present.

## Final resume capsule
Implementation and deployment are complete. Remaining limitation: external validator service error for dice; local/production source checks pass. Google search appearance and indexing are not verified or guaranteed. Do not invent ratings/reviews to obtain app rich results. Existing originals and previous local design CSS versions are retained. Generated panludiq-public directories remain untracked and excluded.
## 2026-11-07 follow-up: external validation completed
The user completed the Schema.org CAPTCHA. Retested the live dice-strategy.html URL in Schema.org Validator: WebPage with nested WebSite/VideoGame, 0 errors and 0 warnings. This resolves the prior external-validator limitation; all 8 page mappings have now passed external schema validation across the recorded checks.
Google Rich Results Test completed at 2026-11-07 05:45:28 KST: no rich results detected. Google's rendered HTML contains the deployed VideoGame JSON-LD. Official Google software-app documentation states VideoGame alone does not yield app rich results; eligibility also requires a supported co-type, offer and real rating/review. No ratings/reviews or production markup were fabricated or altered. Result URL and evidence are retained in dice-verification-20261107.json and screenshots. These verification-only changes require no application redeployment.

## 2026-11-07: supported Google rich-result eligibility
User requested factual additional supported schema, explicitly prohibiting invented ratings/reviews. Official Google breadcrumb documentation supports BreadcrumbList with at least two items; app rich results require actual rating/review unavailable on current site. Implemented visible root-to-game navigation and matching BreadcrumbList on all 7 standalone game pages (including online), linked via WebPage.breadcrumb. Home has no fabricated breadcrumb or phantom popup pages. Existing VideoGame data retained. Generator owns both nav and schema to prevent drift; regeneration removes old nav first. Existing layout/design preserved with small wrapping breadcrumb styles.
Validation before deployment: schema-tests verifies all 7 exact page URLs, names, linked IDs, one visible nav per page, absence of invented reviews; complete verify.cjs engine/assets checks passed. Local strategy-dice browser confirms visible root-to-game path above heading. Deployment and Google live rich-results verification follow this source commit. Same codex/panludiq-design-schema branch; only intended files are staged; existing untracked generated assets untouched.

### Supported breadcrumb production completion
Deployment dep-dbn499rncjis73fhig60 / commit 2cf71d4db4d848854b339ea751bf46e0b4be1894 is LIVE (2026-11-07 06:21 KST). All 7 standalone game URLs return HTTP 200 with visible breadcrumb nav and exact page-specific BreadcrumbList; no reviews or aggregateRating added. Evidence: breadcrumb-production-20261107.json.
Google Rich Results Test on live dice-strategy.html: 1 valid BreadcrumbList item, crawl completed 2026-11-07 06:21:47 KST. Detailed Google result shows positions 1/2 and exact visible names and URLs (판루딕 → 전략 주사위). Result: https://search.google.com/test/rich-results/result?id=12WJqRcbbOau3lfYNGnZgw. Evidence: google-breadcrumb-result-20261107.json and screenshots. Only strategy-dice was tested in Google's external tool in this change; the remaining 6 use the same generator and passed internal schema assertions, visible browser checks, and live HTTP/schema inspection. Do not describe this as all 7 independently tested by Google.
No app review/rating schemas were added because authentic reviews are unavailable. No unrelated FAQ/Product/Event schema was invented. This enables breadcrumb eligibility (currently a desktop search feature per Google's official breadcrumb documentation); actual indexing/search appearance is not guaranteed. Existing popup games remain on home and have no fictitious standalone breadcrumb. Verification-only follow-up requires no new app deployment.

## 2026-11-07 07:01–07:04 KST: all remaining pages directly tested in Google
Submitted six actual production URLs separately through Google Rich Results Test: lights.html, code-breaker.html, number-chain.html, line-control.html, chess.html, online.html. Each completed Google crawl and detected exactly 1 valid BreadcrumbList. Opened each breadcrumb result and expanded its item: names, positions 1/2, canonical root and exact target URL were displayed. No error/warning/non-critical issue appeared in any of the six detail views. All six report errors 0, warnings 0. Together with the earlier dice-strategy.html result, all 7 standalone game pages have now independently passed direct Google URL testing.
Evidence: google-six-results-20261107.json contains result URLs, overview/detail text and counts. Six google-six-*-20261107.png screenshots are retained. No site code/schema changes, fake reviews, or redeployment were needed. These results confirm test eligibility, not actual search indexing or appearance.
