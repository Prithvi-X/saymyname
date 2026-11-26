# Phase 4: Content Accuracy & Production Asset Clearance

**Project:** SayMyName.in — The First Impression Project
**Branch:** `landing-page-repositioning`
**Audit Commit:** `7aebe0397a374e35c975597c18d3e9d2083f01e7`

---

## 1. Content & Product-Accuracy Audit Checklist

| Domain / Surface | Audited Claim & Verification Outcome | Action Taken |
| --- | --- | --- |
| **Eligibility Scope** (`ProgrammeSection.tsx`) | Lists exact four approved IITM non-campus BS tracks (`Data Science and Applications`, `Electronic Systems`, `Aeronautics and Space Technology`, `Management and Data Science`), 18+ requirement, and explicit exclusion of residential campus degrees, alumni, and outside universities. | Verified compliant |
| **Canonical Headline Candidates** (`landing-content.ts`) | Phase 3 had drifted wording for Candidates B & C inside `HERO_CANDIDATES`. | **Corrected:** Restored exact Phase 1/2 canonical `DEC-LP-01` options (`B`: *"Built for real connection across your BS world."*, `C`: *"A calmer place to meet someone who shares your pace."*) |
| **Onboarding Steps Accuracy** (`HowItWorksSection.tsx`, `onboarding/page.tsx`) | Verified Step 4 (`evidenceType` defaults to `'none'`, optional non-ID proof alongside track + level) and Step 5 (bio, coarse city/state, at least one portrait before publishing). Explicitly states manual review with no instant approval claim or fabricated review SLA. | **Corrected:** Tightened Steps 04 & 05 descriptions in `landing-content.ts` to match `onboarding/page.tsx` verbatim |
| **Geographic Representation** (`AcrossCitiesSection.tsx`) | Checked band for any implied member/city count metric. | **Corrected:** Updated meridian header and city chips header to read `"Illustrative Meridian"` / `"Illustrative study cities across distance:"` |
| **Hero Focus Visual Alt Description** (`LandingHero.tsx`) | Checked visual match between `two-lights-detail.webp` image and HTML `alt` text (`spheres` vs architectural columns). | **Corrected:** Updated `alt` text to accurately describe `"Two architectural columns warmed by calm amber and iris light meeting across a dark interval"`, and fixed intrinsic `height` attribute `768` -> `720` to match true `960×720` binary ratio |
| **Product Preview Honesty** (`ProductPreview.tsx`) | Displays `"Sample product preview · Illustrative layout"`, uses fictional sample labels (`Ananya, 22`, `Dev, 23`, `Rohan, 23`) with initial avatar box (`AN`), `Verified` badge matching `Badge.tsx`, local-only state, zero API calls, zero R2 images, zero unshipped Phase 4 calling/voice/game/relationship claims. | Verified compliant |
| **IIT Madras Independence** (`LandingHero.tsx`, `TrustSection.tsx`, `PublicFooter.tsx`) | Clear standalone non-affiliation disclosures maintained cleanly above the fold and in footer. | Verified compliant |
| **Sharing Boundary** (`ShareSection.tsx`) | Shares/copies clean `https://saymyname.in` without `?src=peer`, analytics, or cookies. | Verified compliant |

---

## 2. Production Visual & Typography Asset Provenance Ledger

### 2.1 `3D-01` Two Lights Assets (`apps/web/public/images/landing/3d/`)
Provenance: WebGL2 SDF physically inspired shader renders stored alongside Blender script `build_two_lights_scene.py` inside `docs/implementation/landing-page/phase2-preview/assets/3d/`.

| Asset Path (`apps/web/public/images/landing/3d/...`) | Binary Inspection (`ffprobe` / `PIL`) | Dimensions | File Size | Browser Decode & Clearance Status |
| --- | --- | --- | --- | --- |
| `two-lights-desktop-10bit.avif` | AV1 (`codec_name=av1`, `pix_fmt=yuv420p10le`) | `1280×1320` | `2,975 B` | Decoded cleanly in Chromium 1440/1280/1024/768 (`naturalWidth=1280`). **Cleared technically; awaiting founder `DEC-LP-09` & `DEC-LP-02`** |
| `two-lights-desktop-8bit.avif` | AV1 (`codec_name=av1`, `pix_fmt=yuv420p`) | `1280×1320` | `2,882 B` | Retained in `public/` as 8-bit AVIF binary option (`LandingHero` uses 10-bit AVIF -> WebP fallback cleanly). **Cleared technically; awaiting `DEC-LP-09`** |
| `two-lights-desktop.webp` | WebP RGB | `1280×1320` | `14,216 B` | Universal non-AVIF fallback in `<picture><img>`. **Cleared technically; awaiting `DEC-LP-09`** |
| `two-lights-mobile-10bit.avif` | AV1 (`codec_name=av1`, `pix_fmt=yuv420p10le`) | `960×540` | `1,475 B` | Decoded cleanly in Chromium `<= 430px` mobile viewports (`naturalWidth=960`). **Cleared technically; awaiting `DEC-LP-09`** |
| `two-lights-mobile.webp` | WebP RGB | `960×540` | `4,664 B` | Universal mobile fallback `<source media="(max-width: 767px)">`. **Cleared technically; awaiting `DEC-LP-09`** |
| `two-lights-detail.webp` | WebP RGB | `960×720` | `8,282 B` | Framed focal panel in Hero column (`width={960} height={720}`). **Cleared technically; awaiting `DEC-LP-09`** |
| `two-lights-desktop-master.png` *(Source Archive Only)* | PNG RGB | `1280×1320` | `810,778 B` | Retained strictly inside `docs/implementation/landing-page/phase2-preview/assets/3d/`; excluded from `public/`. |

**Visual Banding & Compression Inspection:** Visual inspection of rendered screenshots (`01-desktop-hero-1440x900.png` and `03-mobile-hero-390x844.png`) shows smooth warm-amber to Mineral Night gradients without severe stair-stepping or compression blocking at ~1.5–14 KB sizes.

### 2.2 Photography Assets (`IMG-01`, `IMG-02`, `IMG-03`)
- **Production Readiness:** **`NOT CLEARED / NOT COMMISSIONED`**.
- Phase 2 commissioning specification exists at `docs/implementation/landing-page/phase2-preview/assets/photography/PHOTOGRAPHY_COMMISSIONING_PACKAGE.md` (`₹32,000 – ₹65,000 INR` non-binding estimate; zero spend authorized).
- **Safeguard Enforced:** Zero placeholder images, AI faces, unlicensed stock imagery, or private member photos exist inside `apps/web/public/`. No `IMG-01..03` image is represented as real photography.

### 2.3 Open Graph Social Assets (`docs/implementation/landing-page/phase2-preview/assets/social/`)
- `og-direction-a-editorial.png` (`1200×630` PNG RGB, `120,791 B`; JPEG candidate `75,911 B`): Left editorial text + right sculpture. Crisp at `1.91:1` horizontal aspect ratio; `1:1` square crops clip the left headline edge.
- `og-direction-b-monolith.png` (`1200×630` PNG RGB, `150,041 B`; JPEG candidate `73,916 B`): Centered card framing designed to keep headline intact inside `1:1` thumbnails; small bottom domain text (`saymyname.in · Independent platform`) compresses modestly at small thumb sizes.
- **Production Status:** **`PROPOSED` (`DEC-LP-06` unresolved)**. Neither file has been copied into `apps/web/public/` nor wired to `openGraph.images` / `twitter.images`.

### 2.4 Typography (`apps/web/app/fonts/`)
- `Instrument Sans` variable fonts (`instrument-sans-latin-normal.woff2` `30,092 B`, `instrument-sans-latin-italic.woff2` `31,828 B`, `latin-ext` subsets `11,144 B` / `11,648 B`) are self-hosted via `next/font/local` with `SIL Open Font License 1.1` preserved verbatim at `apps/web/app/fonts/OFL.txt`.
- Confirmed `0` external requests to `fonts.googleapis.com` or `fonts.gstatic.com`. Weights match Document 10 hierarchy (`400`–`700`).
