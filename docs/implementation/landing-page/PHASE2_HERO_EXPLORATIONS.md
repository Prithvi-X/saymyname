# Phase 2 Hero Explorations & Comparative Study — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 2 of 6 (`DEC-LP-01` & `DEC-LP-02` Comparative Proof)
**Interactive Prototype Control:** Fixed `Phase 2 Review Switcher` in [phase2-preview/index.html](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/index.html) toggles all copy variants and visual compositions live in-browser.

---

## 1. Headline & Copy Explorations (`DEC-LP-01` — `PROPOSED`)

| Candidate | Headline Copy | Visual Eyebrow & Subcopy Emphasis | Assessment in High-Fidelity Layout |
|---|---|---|---|
| **Candidate A *(Provisional Lead)*** | **Same world. Different cities. A chance to meet.** | Eyebrow: `Dating for verified 18+ IIT Madras BS students` · Emphasizes shared BS journey across Indian cities & mutual interest | Clean `3`-line display rhythm (`max-width: 13.5ch`), balances beautifully at `63.4px` next to vertical sculpture aperture; strongest curiosity & WhatsApp shareability |
| **Candidate B *(Alternate Test)*** | **Built for real connection across your BS world.** | Eyebrow: `Independent dating · 18+ IIT Madras BS cohort` · Contrasts dedicated dating privacy against noisy study groups | Crisp, unmistakable insider fit (`comparison_hero_b_3d.png`); slightly denser `4`-line stack at `63px`, very strong clarity for skimmers |
| **Candidate C** | **A calmer place to meet someone who shares your pace.** | Eyebrow: `Dating across distance · Verified IITM BS adults (18+)` · Contrasts anti-swipe calm depth | Grounded tone attractive to mature `23–35+` adults, slightly less distinctively tied to geographic pan-India cohort story |

---

## 2. Focal Visual Composition Comparison (`DEC-LP-02` — `PROPOSED`)

| Option | Visual Makeup | Visual Hierarchy & Brand Strength | Emotional & Human Impact | Payload & Mobile Fold Performance |
|---|---|---|---|---|
| **Option C: Paired (`3D-01` + `IMG-01`) *(Recommended)*** | Left `54%` glowing obsidian `Two Lights` monoliths + Right `46%` warm-lit `IMG-01` human dusk scene | **Highest differentiation:** Unmistakably *SayMyName* (`Mass + Cut + Ember` signature) paired cleanly with human warmth | Signals both architectural poise **and** living adults (`18+`) without fake UI gimmicks | `two-lights` AVIF (`3.0 KB` / `1.5 KB` mobile) + `IMG-01` (`<=90 KB` target) keep total hero media well inside `<2.5s` mobile LCP |
| **Option A: `3D-01` Sculpture Only** | Full-bleed `Two Lights Across the Interval` dark ceramic monolith scene | Purest sculptural elegance (`comparison_hero_b_3d.png`), minimal visual complexity, instant load (`3 KB AVIF`) | Risk: Without human photography inside Section 01, cold visitors must scroll to Section 02/03 to confirm real human warmth | Lightest possible Hero payload (`~3 KB` AVIF / `14 KB` WebP) |
| **Option B: Photography Only (`IMG-01`)** | Full-bleed candid adult dusk window editorial scene | Immediately human & approachable (closest to Hinge/Editorial warmth) | Risk: Loses Document 10's signature sculptural *THE INTERVAL* recognition, making hero visually closer to standard lifestyle sites | Depends on final `IMG-01` commissioning + `AVIF` export (`~55–90 KB`) |

---

## 3. Desktop & Mobile Cropping Strategy

- **Desktop (`1280–1440px`):** `5`-column vertical `4:4.15` stage preserves both the full vertical crown silhouette of `3D-01` and balanced editorial breathing room for `IMG-01`.
- **Tablet (`768×1024`) & Mobile (`375–430px`):** Recomposes smoothly to `16:9` horizontal split (`two-lights-mobile-10bit.avif` + horizontal `IMG-01` center crop) keeping the warm `Ember` aperture illuminated center-left and human atmosphere visible right inside the fold without clipping or horizontal squeeze.

---

## 4. Pending Decisions Preserved
Both **`DEC-LP-01`** (Headline Candidate A vs B vs C; unified `Create Account`) and **`DEC-LP-02`** (Paired Option C vs 3D-only Option A vs Photo-only Option B) remain strictly **`PROPOSED - HUMAN APPROVAL REQUIRED`**.
