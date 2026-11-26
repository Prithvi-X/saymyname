# Phase 4: Accessibility & Usability Audit

**Project:** SayMyName.in — The First Impression Project
**Branch:** `landing-page-repositioning`
**Audit Target:** `http://127.0.0.1:3109/` (`LANDING_PAGE_EDITORIAL_ENABLED=true`, commit `7aebe03`)
**Target Standard:** WCAG 2.2 Level AA engineering alignment *(audited via Chromium Playwright inspection; not an external compliance certification)*

---

## 1. Responsive Multi-Viewport Matrix (All 8 Viewports Tested)

| Viewport | `scrollWidth` / `innerWidth` | Horizontal Overflow | Selected Hero Binary | Minimum Font Size (`<main>`) | Broken Images | Runtime / HTTP Errors |
| --- | --- | --- | --- | --- | --- | --- |
| `1440×900` | `1440 / 1440` | `0 px` | `two-lights-desktop-10bit.avif` (`1280×1320`) | `12 px` | `0` | `0` |
| `1280×720` | `1280 / 1280` | `0 px` | `two-lights-desktop-10bit.avif` (`1280×1320`) | `12 px` | `0` | `0` |
| `1024×768` | `1024 / 1024` | `0 px` | `two-lights-desktop-10bit.avif` (`1280×1320`) | `12 px` | `0` | `0` |
| `768×1024` | `768 / 768` | `0 px` | `two-lights-desktop-10bit.avif` (`1280×1320`) | `12 px` | `0` | `0` |
| `430×932` | `430 / 430` | `0 px` | `two-lights-mobile-10bit.avif` (`960×540`) | `12 px` | `0` | `0` |
| `390×844` | `390 / 390` | `0 px` | `two-lights-mobile-10bit.avif` (`960×540`) | `12 px` | `0` | `0` |
| `375×667` | `375 / 375` | `0 px` | `two-lights-mobile-10bit.avif` (`960×540`) | `12 px` | `0` | `0` |
| `320×568` | `320 / 320` | `0 px` | `two-lights-mobile-10bit.avif` (`960×540`) | `12 px` | `0` | `0` |

---

## 2. Keyboard Navigation & Screen-Reader Semantics

| Audit Item | Observed Behaviour | Result |
| --- | --- | --- |
| Skip Link (`Tab` index 1) | Focuses `A:Skip to main content` -> targets `#main-content` | **PASS** |
| Logical `Tab` Order (first 12 steps sampled) | `Skip to main content` -> Brand `Logo` -> `How It Works` -> `Eligibility` -> `Safety` -> Header `Sign In` -> Header `Create Account` -> Hero `Create Account` -> Hero `See how it works` | **PASS** |
| `ProductPreview` Roving Focus (`role="tablist"`) | Pressing `ArrowRight` from `02. Mutual Match` updates panel to `Private 1:1 Chat` and moves browser focus to `#preview-tab-chat` | **PASS** |
| Mobile Drawer Open & `Escape` | Opens `#mobile-public-drawer` cleanly; pressing `Escape` dismisses drawer and restores focus to toggle button (`[aria-label="Open navigation menu"]`) | **PASS** |
| Reduced Motion (`prefers-reduced-motion: reduce`) | Verified active with zero essential state dependent on CSS transitions | **PASS** |
| Interactive Feedback Announcements | Share button status uses `<p role="status" aria-live="polite">`; Discover preview uses `aria-live="polite"` | **PASS** |
| Touch Target Sizes | Hero `Create Account`: `48 px` height; Hero `See how it works`: `44 px` height; Mobile hamburger toggle (`w-10 h-10` under `15px` root `rem`): `37.5 × 37.5 px` | **PASS (WCAG 2.2 SC 2.5.8 >=24px)** — noted below 44px mobile ideal |

---

## 3. Computed Contrast & Typography Audit (`1440×900`)

| Element | Computed Font Size | Computed Contrast Ratio | Notes |
| --- | --- | --- | --- |
| `hero_h1` (`#F0F1EE` on `#0B0D10`) | `52.5 px` | `17.16 : 1` | AAA |
| `hero_subcopy` (`#B6BDC4` on `#0B0D10`) | `16.875 px` | `10.25 : 1` | AAA |
| `step_body` (`#B6BDC4` on `#0B0D10`) | `13.125 px` | `10.25 : 1` | AAA |
| `hero_secondary_cta` | `13.125 px` | `10.25 : 1` | AAA |
| `nav_link` | `13.125 px` | `10.25 : 1` | AAA |
| `hero_primary_btn` (`#0B0D10` on `#8580C4`) | `15 px` | `5.45 : 1` | AA (normal text pass) |
| `iris_eyebrow` (`#8580C4` on `#0B0D10`) | `12 px` | `5.45 : 1` | AA (normal text pass) |
| `footer_copy` (`#B6BDC4` / `#12161B`) | `11.25 px` *(legacy `text-xs` under `html { font-size: 15px }`)* | `9.57 : 1` | Contrast AAA; shared `PublicFooter` paragraph font size (`11.25px`) noted as minor non-blocking baseline detail |

---

## 4. Documented Limitations

- Screen-reader behaviour was verified through semantic HTML/ARIA roles, live-region attributes, heading order, and Playwright keyboard/focus assertions rather than physical NVDA/JAWS/VoiceOver audio playback sessions.
- Shared `Navbar` mobile drawer button (`w-10 h-10` -> `37.5 × 37.5 px`) satisfies WCAG 2.2 SC 2.5.8 (`24×24 px`) cleanly, though bumping its height/width to `44 px` in a future polish pass is recommended for large-finger ergonomics.
