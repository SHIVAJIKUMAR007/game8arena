# AdSense Action Plan — Game8Arena

**Audited URL:** https://game8arena.com
**Audit date:** 2026-11-27
**Goal:** clear "Low-value content" and be ready for a re-review. Companion to `audit.md`.

Order matters: do the Immediate Fixes first, then wait until the 30-Day fixes are live before requesting a new review. A fast re-request on an unchanged site usually repeats the rejection.

---

## Immediate Fixes
*(Critical / blocking approval. Target: this week.)*

- [x] **Remove the 15 news posts from the site (C2 — Spam Policies: Scaled content abuse; Publisher Content Policies: derivative content).** Removed the 13-post news dataset and the two older entries from the blog registry.
- [x] **Return 301s for removed URLs and drop them from `sitemap.xml`** so Google stops crawling thin pages. Removed the "News" and "Gaming News" categories and checked retained posts for links to retired slugs.
- [x] **Remove the 5 game-concept posts (H3 — Low value content):** removed all five concepts. The retained fighting-games comparison now focuses on Stickman Fight and Multiverse Fighter.
- [x] **Rewrite the About page (H1 — Trust Signals / Low value content).** Added more than 400 words about the operator, games, testing limits, blog process and bug reports. Replaced the game list with a catalogue link.
- [x] **Add a named author and accountable operator (H2 — E-E-A-T).** Added Shivaji Kumar's byline and short bio to every post, `Person` Article authorship, and the operator name to Contact.
- [ ] **Replace the current personal email with a domain mailbox.** No working Game8Arena domain address is available yet; Contact currently identifies the existing address as temporary.
- [ ] **Configure a Google-certified CMP for ads (C3 — EU User Consent Policy).** This requires AdSense account setup and the CMP integration snippet. The AdSense loader and `ads.txt` are now disabled unless `VITE_ADSENSE_CMP_CONFIGURED=true` is set after configuration. The existing analytics consent banner remains; the unrelated GTM loader was removed.
- [x] **Add a `/blog` → `/blogs` redirect (L1 — UX).** Added a 301 for `/blog` and a matching subpath redirect.
- [ ] **Verify the CMP state (C3, re-audit).** `.env.production` has `VITE_ADSENSE_CMP_CONFIGURED=true` while this plan says no CMP exists. Confirm a European regulations message is published in AdSense → Privacy & messaging. If not, set the flag to `false` (or remove it) in `.env.production` and in the host's environment, then redeploy. Live `/ads.txt` is currently served.
- [ ] **Make the `/blog` redirect work live (M2, re-audit).** Live `/blog` and retired posts return 404, not 301. `public/_headers` suggests a Netlify/Cloudflare host that ignores `vercel.json`; add `public/_redirects` or confirm the host.
- [ ] **Do not resubmit yet.** No resubmission was made. Wait until the 30-Day consolidation is live and recrawled (check Search Console → Pages).

## 30-Day Fixes
*(High priority. Target: complete before requesting a new review.)*

- [ ] **Consolidate micro-topic guides into one strong pillar per game (C1, M1 — Scaled content abuse).** Target ≤ 2–3 posts per game. For example, merge the 8 Minesweeper posts (rules, number patterns, chording, safe first click, classic vs campaign) into one 1,800–2,500 word guide plus 1 advanced post, and 301-redirect the retired URLs to the survivor. Repeat for Memory Sequence (7), Merge Rush, Arrow Escape, Box Escape, Word Guess, Color Connect, Pipe Connect, Code Breaker, Klondike, Find God, Traffic Escape. Target total: roughly 35–45 posts, down from 103.
- [ ] **Add real, original value to each surviving post (Low value content):** actual screenshots of the game (not stock photos), worked examples from real levels, move counts or par scores you tested, and what you personally tried. This is the single biggest differentiator from templated content.
- [x] **Replace stock Pexels images with game screenshots (H5).** Done 2026-11-27: all 83 posts now use the 25 files in `public/Game8ArenaGamesImages`, matched to each post's game; the 32 stock files in `public/blog` were deleted. Still open: add your own diagrams or annotated screenshots of specific levels and boards inside posts, since one screenshot per game is reused across that game's posts.
- [ ] **Deepen the 10 thinnest game landing pages (H4):** memory, connect, pipe, sudoku, god, box, merge, traffic, tictactoe, code. Aim for 700–900 words each: how to play, scoring and levels, strategy tips, FAQ, what makes it different. Do not copy text from the blog.
- [ ] **De-duplicate the home page (H4):** replace repeated card text with ~300 words of genuine intro and remove the prose list that duplicates the cards.
- [ ] **Slow the publishing cadence (C1).** From now on, publish 1–2 reviewed posts per week. Never add batches. Do not backdate.
- [ ] **Confirm no real-money or prize language on Tambola/Bingo pages (Publisher Content Policies — Gambling; potential risk).**
- [ ] **Verify the About claim "works offline once installed" or remove it (L3 — Deceptive content).**
- [ ] **Check the Disclaimer page has unique content (L2).**
- [ ] **Run Lighthouse on home, one game page, one blog post; fix any CLS/LCP regressions (UX).**
- [ ] **Pull Search Console data (indexed pages, coverage errors, queries) and domain age; share it so the approval estimate can be updated (M4).**

## 90-Day Improvements
*(Medium / Low and optimization.)*

- [ ] **Build topical authority, not volume (Spam Policies).** Publish a small number of evergreen pieces that match real queries ("how to solve Sudoku", "best brain games") with original comparisons, data from your own games (e.g. average completion times per level, if you hold analytics), and clear editorial standards.
- [ ] **Add an editorial policy page:** how content is researched, tested, AI-assisted (if so) and corrected (Trust).
- [ ] **Add real update history:** a "last reviewed" date based on real edits (M3).
- [ ] **Add `lastmod` to game pages in the sitemap (L4).**
- [ ] **Add a contact form or role mailbox and a stated response time you can meet (L5).**
- [ ] **Grow genuine traffic and return visits:** daily challenge, newsletter, shareable results. Confirm sources are organic (Invalid traffic).
- [ ] **After approval only:** place ads per `audit.md → Ad Placement Recommendations` (none over game controls or canvas; reserved heights; no overlays on gameplay), start with Auto ads on a subset, measure, then go manual.
- [ ] **Complete the AdSense payment profile** (the yellow banner in your screenshot) once approved.
- [ ] **Re-run this audit** after the 30-Day fixes, before requesting the new AdSense review.
