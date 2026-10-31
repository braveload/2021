# Homepage design QA — 2026-10-31

Result: passed for responsive adaptation; not a pixel-identical reproduction.

Reference: user-selected upload/03-1000057393.png (1152 × 1536). Actual browser captures at 1152 × 852 and 393 × 852 iframe viewports (content widths 1137 and 378 after desktop scrollbars). Compared reference and browser top/bottom captures together in ../qa-evidence/desktop-comparison.png and mobile-comparison.png. These are local QA evidence, not application assets.

Fixed P1: isolated rectangular hero replaced with integrated scene; restored image-above-title three-card composition, glass feature strip, five-mode row, and promotional artwork. Mini chess entry follows the reference sections.
Fixed P2: incorrect icon crops, fifth mobile tile wrapping, banner orphan syllable, oversized mobile spacing. No horizontal overflow at tested widths. All browser images loaded.

Functional verification: memory tutorial and 16-card game start work through mobile controls. Console review found browser-extension metadata noise, no observed application errors. Existing automated game and online tests pass.

Intentional functional differences: guest account instead of unimplemented login/signup; local records instead of public ranking; community/events explicitly marked coming soon. Existing online friend match remains available. No new multiplayer claims for single-player games.

Residual P3: font metrics and reconstructed hero room differ slightly from supplied raster. No separate approved mobile mockup existed; mobile preserves artwork, hierarchy, section order, card structure and palette while reflowing the hero and feature strip. No remaining P0/P1/P2 observed in the reviewed captures.
