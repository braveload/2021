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
- Deployment/production verification: next. Publish this exact commit via existing deployment branch, then verify live assets and schema validator. No architecture migration; new static JSON-LD generation runs before existing verification/build.

## Resume
Source is dist; scripts/structured-data.cjs is the structured-data source of truth. Run node scripts/structured-data.cjs and node schema-tests.cjs, then node verify.cjs. Deploy frontend service srv-dbispkks728c7387c150 only. Online service is separate and does not require a deployment.
