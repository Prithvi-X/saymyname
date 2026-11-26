# Phase 5: Final Production Asset Manifest

**Project:** SayMyName.in — The First Impression Project
**Branch:** `landing-page-repositioning`
**Manifest Date:** `2026-11-26`

---

## 1. Included Production Assets (`apps/web/`)

| Production Path | Format / Pixel Format | Dimensions | Size | SHA-256 Hash | Provenance & Rights | Approval Ref |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/web/public/images/landing/3d/two-lights-desktop-10bit.avif` | AVIF (`av1`, `yuv420p10le`) | `1280×1320` | `2,975 B` | `145984A26296110FC0F4EEE5FB41B0EB5F76DF0A061666E0FAA85F0344FC2D5D` | First-party WebGL2 SDF shader render (`build_two_lights_scene.py` companion archive) | `DEC-LP-02`, `DEC-LP-09` (`APPROVED`) |
| `apps/web/public/images/landing/3d/two-lights-desktop-8bit.avif` | AVIF (`av1`, `yuv420p`) | `1280×1320` | `2,882 B` | `11464BB1D5EC1294BC71CCB713114DA9535EEA02D5A2AF43FFD5D4113F7CB16F` | First-party WebGL2 SDF shader render (8-bit fallback binary) | `DEC-LP-09` (`APPROVED`) |
| `apps/web/public/images/landing/3d/two-lights-desktop.webp` | WebP RGB | `1280×1320` | `14,216 B` | `F663970AC4F78372A00B2B12DD599FB15697E335D0F3AEA15229233EA92CB782` | First-party WebGL2 SDF shader render (universal desktop fallback) | `DEC-LP-09` (`APPROVED`) |
| `apps/web/public/images/landing/3d/two-lights-mobile-10bit.avif` | AVIF (`av1`, `yuv420p10le`) | `960×540` | `1,475 B` | `2AF7AAD3A2AB6D8972DC69EA112A956D91396F6AAE13FD8A98826AF029BF63B6` | First-party WebGL2 SDF shader render (mobile crop) | `DEC-LP-09` (`APPROVED`) |
| `apps/web/public/images/landing/3d/two-lights-mobile.webp` | WebP RGB | `960×540` | `4,664 B` | `4D8008C19A27153D1137F15D482971D3772B0EDFCACA4CFF6660541556D9CE93` | First-party WebGL2 SDF shader render (mobile WebP fallback) | `DEC-LP-09` (`APPROVED`) |
| `apps/web/public/images/landing/3d/two-lights-detail.webp` | WebP RGB | `960×720` | `8,282 B` | `206C3EA46733ECDD86A0E17C250F643A1778A2823F9928CF98EE8EB85E5597B0` | First-party WebGL2 SDF shader render (Hero inset study) | `DEC-LP-09` (`APPROVED`) |
| `apps/web/public/images/landing/og/saymyname-og-direction-a.png` | PNG RGB | `1200×630` | `120,791 B` | `79AB84C400C80A3D9D90CDE65DDFC7DF913F322CD0A7431216331A80D190A4D3` | First-party Direction A social share card (`og-direction-a-editorial.png`) | `DEC-LP-06` (`APPROVED`) |
| `apps/web/app/fonts/instrument-sans-latin-normal.woff2` | WOFF2 variable | N/A | `30,092 B` | `2EE17598A98D8A59E4DF8152D015BEC9AB8E4D5672CC0AB42BEF806B568E3971` | Instrument Sans (`SIL Open Font License 1.1` at `OFL.txt`) | Document 10 |
| `apps/web/app/fonts/instrument-sans-latin-italic.woff2` | WOFF2 variable | N/A | `31,828 B` | `77210CDDE0281B5ECB0D592E063A98656F1BC36993A3B98F506EB91FF4A433A5` | Instrument Sans Italic (`SIL OFL 1.1`) | Document 10 |
| `apps/web/app/fonts/instrument-sans-latin-ext-normal.woff2` | WOFF2 variable | N/A | `11,144 B` | `C4FCFEA41F2C1CFEEA9211FA43679845454A1D0E0D7E95E069C7E73C4AE302D2` | Instrument Sans Latin-Ext (`SIL OFL 1.1`) | Document 10 |
| `apps/web/app/fonts/instrument-sans-latin-ext-italic.woff2` | WOFF2 variable | N/A | `11,648 B` | `2C2D6EB042595041B9E9077CA76962EF3B8DABD7E50169A47DE343A24CEC05F6` | Instrument Sans Latin-Ext Italic (`SIL OFL 1.1`) | Document 10 |

---

## 2. Archived / Excluded Non-Production Assets

- `docs/implementation/landing-page/phase2-preview/assets/3d/two-lights-desktop-master.png` (`810,778 B`, SHA-256 `C7CD5388E53A6E6576E3CB4ADBE84E1576B4B9CE95E38D1A6E4BFA88B2DCD6D3`): Uncompressed master retained out of `public/`.
- `docs/implementation/landing-page/phase2-preview/assets/social/og-direction-b-monolith.png` (`240BAE594BD8E2549198810615FF9DE98275899DFA80A70DE63AB3E8D11DE5A9`) & `.jpg` alternatives: Retained as Phase 2 design history; excluded from `public/` per Direction A approval (`DEC-LP-06`).
- `IMG-01`, `IMG-02`, `IMG-03`: Not commissioned per founder decision `DEC-LP-02` (Option A `3d-led`); zero photography placeholder files reside in `apps/web/public/`.
