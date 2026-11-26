# Phase 2 Visual QA & Multi-Viewport Verification Report — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 2 of 6 (`Workstream D` & `Workstream F`)
**Targets Audited:**
1. High-Fidelity Landing Prototype: [phase2-preview/index.html](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/index.html) across `7` viewports (`1440px`, `1280px`, `1024px`, `768px`, `430px`, `390px`, `375px`) via headless Chromium.
2. Live Built Next.js Foundation (`127.0.0.1:3105`): Guest `/` + `9` subroutes + `/sitemap.xml` + `/robots.txt`.

---

## 1. Multi-Viewport Prototype Audit (`7` Target Viewports)

| Viewport (`vw × vh`) | Horizontal Overflow? | H1 Size | Primary CTA Bottom | Hero Visual In-Fold % | Page JS Errors | Inspected Visual Verdict |
|---|---:|---:|---:|---:|---:|---|
| `1440 × 900` (`desktop_1440_fold.png`) | `False` | `63.36px` | `547px` (`In Fold`) | **`100%`** (`150..645px`) | `0` | Crisp `64px`-class display hierarchy; Band 2 *"Why we built this"* invites scroll gently at fold bottom |
| `1280 × 720` (`laptop_1280_fold.png`) | `False` | `56.32px` | `526px` (`In Fold`) | **`100%`** (`140..634px`) | `0` | Clean 12-col Hero fit inside tighter `720px` laptop height without touching CTA or sculpture margins |
| `1024 × 768` (`inter_1024_fold.png`) | `False` | `50.00px` | `508px` (`In Fold`) | **`100%`** (`180..575px`) | `0` | Intermediate desktop scales smoothly with balanced gutters |
| `768 × 1024` (`tablet_768_fold.png`) | `False` | `46.00px` | `476px` (`In Fold`) | **`100%`** (`626..946px`) | `0` | Eliminated Phase 0 `200px` blank zone and oversized schematic box; wide `16:9` stage anchors bottom cleanly |
| `430 × 932` (`mobile_430_fold.png`) | `False` | `35.00px` | `378px` (`In Fold`) | **`100%`** (`554..730px`) | `0` | Spacious single-col editorial Hero; hamburger toggle replaces wrapped links cleanly |
| `390 × 844` (`mobile_390_fold.png`) | `False` | `35.00px` | `378px` (`In Fold`) | **`100%`** (`554..730px`) | `0` | Eliminated Phase 0's clipped card edge completely |
| `375 × 667` (`mobile_375_fold.png`) | `False` | `35.00px` | `378px` (`In Fold`) | **`55%`** (`571..667px`) | `0` | Major upgrade over Phase 0 (`0%` visual in fold): full headline + CTA + trust/affiliation + illuminated `Two Lights` aperture show cleanly inside initial `667px` fold |

---

## 2. Defect Found & Fixed During Phase 2 Visual Inspection

1. **`375px` Hero Regression Caught & Fixed:** Initial Phase 2 CSS had pushed `#hero-visual-stage` to `y=647px` (`11%` visible) on `375×667`. Tightening mobile navbar (`56px`), H1 (`35px`), paragraph spacing (`14px`), and inline trust margins pulled `#hero-visual-stage` back up to `y=571px` (`55%` above fold — showing the warm glowing aperture cleanly).
2. **`IMG-01` Placeholder Left Crop Caught & Fixed:** Top-aligned `PLACEHOLDER - NOT APPROVED FOR PRODUCTION` header inside `img-01-hero-placeholder.webp` clipped horizontally inside the narrower paired Hero inset on `desktop_1440_fold.png`. Repositioning the placeholder stamp into centered narrow-column layout resolved truncation `100%` cleanly.
3. **OpenGraph Direction A 4-Line Wrap Caught & Fixed:** Adjusted `.og-h1` from `58px / 13ch` to `54px / 15.5ch`, producing crisp 3-line display hierarchy (`Same world. / Different cities. A / chance to meet.`) inside `og-direction-a-editorial.png`.

---

## 3. Interaction, Accessibility & 3D Quality Checks

- **Product Preview Tabs (`verify_phase2_preview.py`):** Confirmed `Discover` (default), clicking tab 2 displays `#view-match` (`true`), and clicking tab 3 displays `#view-chat` (`true`).
- **3D Material & Codec Inspection (`cmp_3d.png`):** Verified `10-bit AVIF` (`2,975 B`), `8-bit AVIF` (`2,882 B`), and `WebP` (`14,216 B`) show accurate warm `Ember` aperture reflections, soft contact shadows, subtle `Iris` rim, and clean gradients on `#0B0D10`.
- **Built Next App Check (`http://127.0.0.1:3105/`):**
  - `consoleErrors`: `[]` (`0` errors on anonymous arrival; `401` resolved cleanly).
  - `externalGoogleFontRequests`: `[]`; local Next WOFF2 fonts loaded (`3` active rules).
- **Measurement Scope Note:** Full production Lighthouse Core Web Vitals (`LCP` / `INP` / `CLS` on deployed production assets with commissioned photography `IMG-01..03`) will be executed during Phase 5 once final photography and the approved Hero replace current `/` in Phase 3/4.
