# Logo motion and Haru Hankan banner

2026-11-03. Basef426aaf. User confirmed: animate Panludiq logo and place a Haru Hankan advertisement on Panludiq homepage (not the reverse placement).

## Scope
- Preserve original logo image files. CSS entrance/settle plus brief glint on header logos; one playback, settled within3.6seconds. Reduced-motion users get the static original. No sound, animation library or recurring distraction.
- Homepage sponsor panel below game/mode selection and above benefits. Clear advertisement label, original Haru five-square symbol, current landing-page/logo/branding service copy, external link to verified https://haru-hankan.onrender.com/.
- Current Haru site and Render service verified read-only. Original symbol copied byte-for-byte from its public brand asset. Haru site itself is not changed. No prices, unsupported performance claims or tracking scripts added.
- Existing game layouts, engines, difficulty, saves and records unchanged. Deck-builder remains held.

## Validation plan
Full existing build; desktop/mobile banner placement and overflow; logo motion ends, original artwork unchanged, reduced-motion static; banner opens correct Haru page in new tab with no opener; original popups and independent game pages still work and storage remains unchanged. Deploy to current Panludiq static service and verify public result.

Local build and browser checks passed. Homepage at 320/390 px has no horizontal overflow; motion finishes and reduced motion is static; outbound destination and unchanged storage verified. Existing chess board is 380 px wide at viewport 320 px both with and without new CSS (pre-existing, unchanged). Production verification passed at https://panludiq.onrender.com. Deploy dep-dbku7ugae00c73811ljg is live on commit 06fcd2ce59f6f392fdd78dce87e75fac295a9cea (2026-11-03 22:39 KST). Production browser checks passed including outbound link, motion, mobile widths and storage preservation; no JavaScript errors. Public text content matches checkout after Git newline normalization and original logo bytes are identical. Evidence: brand-production/brand-results.json under the current visualization output directory.
