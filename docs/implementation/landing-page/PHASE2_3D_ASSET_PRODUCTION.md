# Phase 2 3D Asset Production Report (`3D-01`: *Two Lights Across the Interval*) — SayMyName.in

**Project:** SayMyName.in — The First Impression Project
**Phase:** 2 of 6 (`Workstream B`)
**Asset Directory:** [phase2-preview/assets/3d/](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/assets/3d/) & [phase2-preview/3D-01/](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/3D-01/)

---

## 1. Environment Honesty & Production Method

- **Blender Inspection Result:** Verified via system command checks (`Get-Command blender`, `Program Files\Blender Foundation*`) that **Blender is NOT installed** in this Windows environment, and Phase 2 prohibits unapproved installation of external rendering tools.
- **Exact Honest Pipeline Delivered:**
  1. Authored a complete, reproducible Blender `4.x` Cycles script ([build_two_lights_scene.py](file:///i:/saymyname-landing/docs/implementation/landing-page/phase2-preview/3D-01/build_two_lights_scene.py)) specifying meshes, architectural bevel modifiers, procedural basalt/ceramic micro-bump PBR shaders, brushed bronze inner bevels, `AgX` colour transform, area-light geometry, and `16-bit` PNG export ready to build **`two-lights.blend`** on any Blender workstation (`blender -b -P build_two_lights_scene.py`).
  2. Built and executed a headless Chromium **WebGL2 Signed-Distance-Field (SDF) Physically Based Raymarching Renderer** (`render_two_lights.py`, stored in session scratch) to synthesize real lit `3D` light-bounce, soft shadow casting, floor contact darkening, `Ember` brushed-alloy specular bevels, subtle `Iris` crown rim, ACES filmic tone mapping, and ordered dithering across Desktop (`1280×1320`), Mobile (`960×540`), and Detail Macro (`960×720`) camera angles—and encoded real **`10-bit AVIF`**, **`8-bit AVIF`**, and **`WebP`** files via `ffmpeg` (`libaom-av1` + `libwebp`).
- **Limitation Disclosure:** Current raster files (`two-lights-desktop-*`, `two-lights-mobile-*`, `two-lights-detail.webp`) are **high-precision SDF PBR shader renders**, NOT Blender Cycles `.blend` path-traced bakes. Final `two-lights.blend` baking requires running `build_two_lights_scene.py` on a workstation with Blender installed.

---

## 2. Geometry, Materials, Lighting & Camera

- **Forms:** Asymmetric pair of matte monoliths (`Left: ~0.56w × 1.88h` rotated `+12.6°`, `Right: ~0.60w × 2.14h` taller rotated `-10.3°`) separated by a calibrated negative-space interval grounded cleanly on an obsidian floor fading smoothly into `Void #0B0D10`.
- **Materials:** High-roughness dark basalt/ceramic primary faces (`#11151B`, micro-normal grain `0.60–0.74` roughness, zero glossy mirror chrome) transitioning cleanly onto warm brushed alloy inner chamfers (`0.32` roughness catching warm specular highlight strictly along the inward gap faces).
- **Lighting:**
  - *Primary Key:* Recessed `Ember #E18A62` warm light positioned behind the aperture casting soft warm falloff and real contact floor shadow.
  - *Secondary Fill:* Subtle low warm floor bounce + controlled top-left cool `Iris #8580C4` rim silhouette light separating dark blocks cleanly from `#0B0D10` without neon glow or bloom clutter.
- **Camera Angles Inspected:**
  - Desktop Full Hero (`1280×1320`, `pos: [0.42, 1.62, -4.65]` looking slightly down so full top silhouette and floor contact shadow sit crisply inside frame).
  - Mobile Horizontal Hero (`960×540`, `pos: [0.32, 1.48, -4.15]`).
  - Macro Material & Chamfer Detail Crop (`960×720`, `pos: [0.18, 1.25, -2.15]`) verifying bevel catchlights and ceramic micro-surface.

---

## 3. Exported Assets, Codec Comparison & Visual Quality Verification

All exported `.avif`, `.webp`, and `.png` files were visually decoded side-by-side in Chromium headless and inspected for dark-gradient banding, shadow preservation, bevel sharpness, and `Ember` warmth accuracy:

| Asset Filename | Format / Pixel Spec | Dimensions | Measured File Size | Inspected Visual Verdict |
|---|---|---|---|---|
| `two-lights-desktop-10bit.avif` | AVIF (`libaom-av1`, `yuv420p10le`, CRF `20`) | `1280 × 1320` | **`2,975 bytes`** (`2.9 KB`) | Crisp matte surfaces, smooth dark gradients into `#0B0D10`, zero visible banding |
| `two-lights-desktop-8bit.avif` | AVIF (`libaom-av1`, `yuv420p`, CRF `24`) | `1280 × 1320` | **`2,882 bytes`** (`2.8 KB`) | Virtually indistinguishable on bright panel, subtle quantization near deep floor fade |
| `two-lights-desktop.webp` | WebP (`libwebp`, Q `88`) | `1280 × 1320` | **`14,216 bytes`** (`13.9 KB`) | Clean universal fallback; preserves chamfer glow & silhouettes |
| `two-lights-desktop-master.png` | Lossless PNG | `1280 × 1320` | `810,778 bytes` | Uncompressed source master for inspection |
| `two-lights-mobile-10bit.avif` | AVIF (`libaom-av1`, `yuv420p10le`, CRF `20`) | `960 × 540` | **`1,475 bytes`** (`1.4 KB`) | Sharp centered mobile `16:9` crop; loads near-instantaneously |
| `two-lights-mobile.webp` | WebP (`libwebp`, Q `88`) | `960 × 540` | **`4,664 bytes`** (`4.6 KB`) | Clean mobile fallback |
| `two-lights-detail.webp` | WebP (`libwebp`, Q `90`) | `960 × 720` | **`8,282 bytes`** (`8.1 KB`) | Verifies fine matte ceramic roughness vs warm brushed chamfer transition |

**Why File Sizes Came Out Under Target (`~1.5–14 KB` vs `35–140 KB`):** Minimalist architectural surfaces fading smoothly to uniform `#0B0D10` compress exceptionally efficiently in AV1/WebP without sacrificing edge detail. When replaced with a final Cycles high-sample multi-bounce `.blend` render (adding slightly richer micro-stone specular variation), verify re-encoded `10-bit AVIF` quality visually first regardless of kilobyte size.

---

## 4. Motion, Reduced-Motion & Static Fallback

- **Chosen Behavior:** Default static `<picture>` (`AVIF` priority + `WebP` fallback) enhanced purely with a restrained one-time entrance settle (`280ms cubic-bezier(0.2, 0.7, 0.2, 1)`, opacity `0.72 -> 1`, `translateY(6px -> 0)`).
- **Explicitly Excluded:** Zero continuous rotation loops, zero initial-load Three.js/WebGL scene runtime, zero Spline embeds.
- **`prefers-reduced-motion: reduce`:** Immediate opacity `1`, zero transform or animation movement.
