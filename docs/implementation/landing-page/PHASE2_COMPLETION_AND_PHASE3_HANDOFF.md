# Phase 2 Completion & Phase 3 Implementation Handoff — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 2 of 6 (`Completed Ready for Human Gate`)
**Branch / Worktree:** `landing-page-repositioning` @ `i:\saymyname-landing`
**Base Baseline:** `9e1a58dd38c173769f46390f06cd07be2859cc54`

---

## 1. Summary of Phase 2 Deliverables

1. **Preserved Prior Milestones (`0f9431c`):** All `6` Phase 0 reports, `9` Phase 1 blueprints, and `wireframe-prototype.html` retained intact cleanly.
2. **High-Fidelity Design Prototype (`4d356c9`):** Full 8-band *Editorial Romance* experience inside [phase2-preview/index.html](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/index.html) featuring live `DEC-LP-01` & `DEC-LP-02` review toggles, interactive 3-tab `Inside SayMyName` showcase (`Sample product preview · Illustrative`), clean ruled community ledger, `Share SayMyName` demo, and full `7`-viewport verification (`1440`–`375px` with `0` overflow).
3. **3D Hero Asset (`3D-01` *Two Lights Across the Interval*):** Reproducible Blender Python scene script ([build_two_lights_scene.py](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/3D-01/build_two_lights_scene.py)) plus inspected WebGL2 SDF PBR raster renders in `10-bit AVIF` (`2.9 KB` desktop / `1.4 KB` mobile), `8-bit AVIF`, `WebP`, macro detail, and PNG master. *(Limitation transparently noted: Blender not installed in environment; Blender scene ready for external studio bake.)*
4. **Photography Commissioning Package:** Complete legal/creative briefs ([PHOTOGRAPHY_COMMISSIONING_PACKAGE.md](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/assets/photography/PHOTOGRAPHY_COMMISSIONING_PACKAGE.md)) + 3 cleanly badged `PLACEHOLDER - NOT APPROVED FOR PRODUCTION` frames (`IMG-01..03`) with zero spend or fake faces.
5. **Social & Open Graph Artwork (`1200×630`):** Two inspected OG directions ([og-direction-a-editorial.png](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/assets/social/og-direction-a-editorial.png) & [og-direction-b-monolith.png](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/assets/social/og-direction-b-monolith.png)) held outside `apps/web/public/` awaiting sign-off.
6. **Public Technical Foundation (`ade2e3e`, `08e066c`, `c14ca8e`):**
   - Self-hosted SIL OFL 1.1 `Instrument Sans` (`woff2`, `0` external font requests).
   - Eliminated anonymous guest `401` console error (`GET /api/auth/csrf` `hasSession` hint + strict fail-closed `/api/auth/me` security + `6` new passing tests; `19/19` web unit tests total).
   - Added distinct per-route SEO metadata across `10` public/auth routes + `/sitemap.xml` + `/robots.txt` (`32/32` Next.js production routes built cleanly).

---

## 2. Status Ledger (`Ready vs Placeholder vs Blocked`)

- **Production-Ready Now (Live Foundation Verified):** Self-hosted `Instrument Sans`, clean anonymous session probe, per-route SEO metadata, `sitemap.ts`, `robots.ts`, `build_two_lights_scene.py`.
- **Design Ready / Awaiting Decision Gate (`DEC-LP-01..06`):** Landing-page JSX layout (`phase2-preview/index.html` blueprint), Headline (`Candidate A`), Hero mode (`Option C` Paired vs `Option A` `3D-Only`), OG share card (`Direction A` vs `B`), and header links (`DEC-LP-03`).
- **Placeholder / Commissioning Needed Before Production Launch:** `IMG-01`, `IMG-02`, `IMG-03` editorial photography shoot (requires model consent including explicit UI-sample release for `IMG-03`). *Note: Option A (`3D-01` sculpture only) allows Phase 3 Hero shipping without delaying for external photo shoot if `IMG-02/03` use approved interim visuals or shoot precedes launch.*
- **Blocked / Not Authorized:** Analytics SDKs or event persistence (`DEC-LP-05` + `Doc 01 §01` legal counsel review), live `/` replacement (`Phase 3`), external spend, production deploy.

---

## 3. Exact Phase 3 Engineering Scope (Once Approved)

1. Copy approved `3D-01` `AVIF`/`WebP` files, final cleared photography (`IMG-01..03`), and chosen `og-saymyname.{png,jpg}` into `apps/web/public/images/landing/`.
2. Add `openGraph.images` + `twitter.images` to `apps/web/app/page.tsx` metadata pointing to the placed static `/og-saymyname.png`.
3. Update [Navbar.tsx](file:///i:/saymyname-landing/apps/web/components/Navbar.tsx) visitor links (`How It Works`, `Eligibility`, `Safety`, `Sign In`, `Create Account`) and add `#main-content` skip-link in `layout.tsx`.
4. Implement the approved 8-band *Editorial Romance* landing page inside `apps/web/app/page.tsx` using Document 10 components, accessible `role="tablist"` on Section 03 preview, clean `scroll-margin-top`, and client `navigator.share` / clipboard fallback on `Share SayMyName` (without tracking code unless `DEC-LP-05` clears legal gate).
5. Run Phase 3 full E2E, WCAG 2.2 AA accessibility, mobile `375px` fold, and Lighthouse Core Web Vitals verification (`LCP < 2.5s`, `INP < 200ms`, `CLS < 0.1`).
