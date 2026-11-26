# Phase 1 3D Art Direction & Photography Asset Specification — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Authority:** `Document 10 (§04, §07, §08, §13, §14, §15, §19)` + `PHASE0_BRAND_AND_VISUAL_DIRECTION.md`  
**Phase 1 Rule:** **Specification Only.** Zero final renders generated, zero 3D libraries (`three`, `@splinetool/react-spline`) installed, zero source files edited. Asset production executes in **Phase 2 / Phase 4**.

---

## 1. 3D Concept Selection & Comparative Analysis

Phase 0 explored three original directions grounded in **THE INTERVAL** (*Mass + Cut + Signal*) while rejecting cliché orbs, neon gradients, pixel noise, glowing cubes, pink glossy hearts, and Breaking Bad tropes.

| Criterion | Concept 1: **Two Lights Across the Interval** *(Recommended)* | Concept 2: **The Folded Letter & Threshold Key** | Concept 3: **Coarse Geography Glass** |
|---|---|---|---|
| **Visual Metaphor** | Two dark matte ceramic architectural monoliths facing across a deliberate aperture illuminated by warm `Ember` bounce light | Two offset matte-graphite plates separated by a hairline warm seal ready to align | Two smoked-glass optical lenses refracting separate regional warm/iris highlights toward center |
| **Emotional Alignment (*Editorial Romance*)** | Quiet recognition, tension before connection, warmth inside darkness without sentimental clichés | Tactile correspondence, written prompts, consent before opening conversation | Direct visual rhyme with *"Different cities. A chance to meet."* + coarse-location privacy |
| **Silhouette Legibility at Mobile Crop (`339×191px`)** | **Highest** — bold two-block architectural silhouette remains unmistakable even small | Medium — razor-thin hairline gap loses crispness when scaled down to `339px` mobile crop | Low-Medium — dark refractive glass often flattens into grey shapes at small mobile sizes |
| **Document 10 Material Purity (`§04, §14`)** | Purest (`Matte ceramic` + `Black stone` + subtle `Warm brushed alloy` chamfer). Zero glassmorphism risk! | Pure (`Black stone` + `Anodised metal`). Crisp typography complement | Carries visual proximity risk to prohibited glass-tile tropes (`§04 R16`) unless painstakingly art-directed |
| **Paired Photography Integration** | Pairs seamlessly beside an atmospheric human photograph (`IMG-01`) as an object-in-space focal signature | Slightly heavy/literal beside portrait framing | Harder to blend cleanly alongside photography due to competing light refraction |
| **Recommendation Verdict** | **RECOMMENDED HERO SIGNATURE (`3D-01`)** | **Optional Product Preview / Match Motif (`Discover -> Match` card motif)** | **Reserve / Explore only if photography omitted** |

---

## 2. Detailed Specification: `3D-01` (*Two Lights Across the Interval*)

### Visual Symbolism
- Expresses Document 10's core thesis: *"Two identities. One moment of recognition."*
- Neither monolith loses its individuality nor touches prematurely. Instead, their opposing beveled inner edges catch a single warm `Ember (#E18A62)` interior glow across dark `Void (#0B0D10)` space, subtly bridged by a faint `Iris (#8580C4)` horizon rim on the outer plane—signifying **two adults in separate cities sharing one moment of recognition**.

### Placement, Composition & Negative Space (`Desktop & Mobile`)
- **Desktop (`1440px` / `1280px` Hero Right, Cols `8–12`):** Anchored cleanly inside a paired visual stage (`~480×520 px` max canvas) where **`3D-01`** forms the sculpted dark focal frame/anchor overlapping or paired asymmetrically with editorial campaign photograph **`IMG-01`** (`65%` sculptural atmosphere / `35%` human moment, OR clean side-by-side diptych depending on Decision 2 human choice).
- **Tablet (`768px`):** Horizontal `16:9` widescreen stage (`704×310 px`) pairing `3D-01` (`left 55%`) cleanly beside `IMG-01` (`right 45%`) on unified `Void` stage gradient.
- **Mobile (`375px–430px`):** `16:9` (`339×191 px` min) responsive crop centering directly on the glowing inner chamfer & warm light channel, keeping silhouette dramatic and centered without awkward half-cuts.
- **Relationship to Typography:** At least `40 px` clear breathing gutter between `H1` right edge and `3D-01` left edge; dark `Void` edge vignettes around `3D-01` blend seamlessly into page stage so zero hard rectangular box border competes with copy.

### Materials & Lighting Spec (For Phase 2 Blender/3D Execution)
- **Primary Forms (Monoliths):** Matte dark charcoal ceramic / obsidian basalt (`#11151B` base albedo, high roughness `0.68–0.78`, micro-stone subtle surface bump—no noisy grain!).
- **Inner Chamfer / Seam:** Warm brushed dark bronze/alloy (`#E18A62` warm specular reflection response, roughness `0.35`, catching hidden point/area light recessed between planes).
- **Key Light:** Single warm softbox key (`3000K` tungsten / `Ember`-shifted tint) positioned slightly behind/inside the gap illuminating the interior walls softly.
- **Fill / Edge Light:** Controlled cool `Iris (#8580C4)` edge rim grazing the outer top-left silhouette (`15–20%` intensity—subtle depth only; **zero neon purple bloom, zero glow halos**).
- **Shadows:** Real physically calculated Cycles/path-traced contact shadows falling across dark slate floor plane fading continuously into `#0B0D10`.

### Motion, Static Fallback & Accessibility
- **Primary Behavior (Option A Baseline):** Pre-rendered static studio `AVIF` / `WebP` composition + ultra-light `CSS` `260ms` cubic-bezier `(0.2, 0.7, 0.2, 1)` entrance settle (`translateY(8px -> 0)`, subtle inner light opacity fade-in `0.85 -> 1.0`, **zero continuous looping loops** on background elements per Doc 10 `L1162`).
- **`prefers-reduced-motion: reduce`:** Immediate opacity `1`, zero transform transitions.
- **Accessibility:** Treated as expressive artwork (`alt=""` when decorative alongside descriptive H1/subcopy, OR crisp concise `alt="Sculptural monoliths lit across an open space, symbolizing two people meeting across distance"` if paired inside semantic `<figure>`). Never overlays interactive buttons on top of the sculpture.

---

## 3. Technical Format, Dimensions & File-Size Budget Check *(Honest Verification)*

Phase 0 tentatively cited `35–90 KB` for static `AVIF`/`WebP` renders. **Phase 1 technical verification nuance:**
- Dark-toned studio renders with subtle warm light gradients over `#0B0D10` are **highly susceptible to 8-bit macroblocking and colour banding** if compressed aggressively down to `35 KB` at `1200×1200 px` retina display resolution!
- **Verified Realistic Targets Pending Phase 2 Test Exports:**
  - *Never claim `35–90 KB` holds until representative dark Blender Cycles frames are encoded and visually inspected on low-end LCD mobile & OLED screens.*
  - Use **responsive `<picture>` / Next `<Image>` `srcSet`** (`640w`, `960w`, `1280w`) in `AVIF` (10-bit pixel format natively avoids dark-gradient banding!) with `WebP` fallback:
    - **Desktop Hero `3D-01` (`960–1200px` wide `AVIF`):** Realistic target **`65–140 KB`** (`WebP` fallback `95–180 KB`).
    - **Mobile Hero Crop (`640–750px` wide `AVIF`):** Realistic target **`35–75 KB`** (well within mobile 4G `<2.5s` LCP budget!).
- **Runtime Decision Reaffirmed (`P0`):** Keep **Zero Three.js / Spline JS runtime** in Phase 2–3 public MVP so total Hero JS stays minimal (`~134 KB` base React/Next framework) and mobile INP stays `<50ms`.

---

## 4. Photography & Human Storytelling Plan

### Why Photography Is Essential (`Doc 10 §13`)
Even the finest 3D sculpture cannot carry human dating desirability alone. Visitors need **believable human presence**—adults `18+` in everyday Indian academic/urban settings under warm, honest evening light.

### Aesthetic Direction
- **Subjects:** Natural Indian adults aged `20–27` (reflecting core UG/diploma/early-career BS cohort cleanly `18+` without looking teenage/juvenile or stiffly corporate).
- **Environments:** Genuine evening library corner, rainy-evening café window with tea/notebook, quiet twilight rooftop/metro overlook, natural apartment study desk with warm bedside lamp—subtly echoing *"different cities, shared evening study rhythm"*.
- **Color & Lighting Grade:** Warm tungsten key (`Ember`-compatible skin warmth) balanced against cool twilight blue-slate shadows (`Void`/`Coal` harmonious). Preserve authentic natural skin tones (`Doc 10 L1006`: **never apply blue/purple tints to human faces!**).

### Strictly Avoid
- Overly rehearsed couples laughing at a restaurant stock cliché.
- Synthetic AI-generated glossy faces (`Doc 10 L1002` strict prohibition).
- Fake member captions pretending a model is an active student (`"Rohan, 21, verified IITM BS"`).
- IIT Madras campus gates, red-brick iconic academic buildings, or logos (`D-01` non-affiliation compliance).

### Consent, Labelling & Rights Rules (`Doc 10 §13`)
| Image Usage Type | Must Carry Explicit Label? | Consent / Licensing Needed |
|---|---|---|
| Atmospheric Brand / Campaign Scene (`IMG-01`, `IMG-02`) | No member claim ever attached; treated purely as editorial backdrop photography | Commercial model release / verified royalty-free or commissioned shoot rights with full web usage licence |
| Product Preview Sample Portrait (`IMG-03` inside Section 03 `Discover` frame) | **YES — Mandatory visible UI badge/caption:** `"Sample product preview · Illustrative profile"` | Commissioned model with **explicit written consent for dating-app UI demonstration use** (OR high-craft editorial non-stock portrait cleared specifically for app-mockup display—never scraped, never real SayMyName user R2 media!) |

### Minimal Asset Inventory (`4` Unique Assets Total — Zero Bloat)

| Asset ID | Section | Subject & Visual Composition | Desktop Aspect | Required Crop | Mobile (`<=430px`) Variant | Rights / Clearance Needed | Max File Target (`AVIF`) |
|---|---|---|---|---|---|---|---|
| `3D-01` | `01` Hero Focal | *Two Lights Across the Interval* ceramic/basalt monoliths + warm aperture light | `4:4.2` (or `5:5`) | Center aperture + bevel | `16:9` tight crop (`640×360`) | Original commissioned 3D scene owned by SayMyName | `<=130 KB` desktop / `<=70 KB` mobile |
| `IMG-01` | `01` Hero Atmosphere *(Paired or Decision 2 Option B/C)* | Candid 20s adult smiling thoughtfully near warm evening café window light (shallow depth, natural look—no fake camera-stare grin) | `4:5` or integrated inset beside `3D-01` | Off-center breathing headroom | Combined seamlessly into `16:9` Hero stage | Commissioned / commercial model release for dating brand | `<=90 KB` desktop / `<=55 KB` mobile |
| `IMG-02` | `02` Across Cities & Screens | Warm dusk cityscape desk/balcony coffee & laptop mood suggesting independent study across India | `4:3` (`480×360`) | Horizon + foreground hand/cup | `16:10` wide crop (`394×246`) | Commissioned or verified commercial licence | `<=85 KB` |
| `IMG-03` | `03` Product Preview (`Discover` Sample Card) | Authentic natural daylight/indoor adult portrait matching real `Discover` `4:4.2` card frame (`discover/page.tsx:577`) | `4:4.2` | Top-of-head safe portrait crop | `4:3` card top frame | **Explicit written dating-UI mockup model release** (never real user, never AI face) | `<=75 KB` |

---

## 5. Phase 2 Production Checklist (Handoff Readiness)
1. Validate Decision 2 (`3D-01 + IMG-01` paired vs photography-led vs 3D-only Hero) with Human Owner before rendering final commissions.
2. Export `3D-01` Blender Cycles passes in `16-bit PNG` master -> inspect `10-bit AVIF` & `WebP` encodings for zero dark-shadow banding on cheap TN/IPS laptops and budget Android screens.
3. Secure written model release explicitly permitting *"dating application website illustration"* for `IMG-01` & `IMG-03` prior to Phase 4 integration.
4. Keep `public/images/landing/` completely isolated from authenticated R2 media buckets (`no real member CDN overlap`).
