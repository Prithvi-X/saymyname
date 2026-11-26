# Phase 3: Accessibility & Responsive QA Report

**Project:** SayMyName.in — The First Impression Project
**Branch:** `landing-page-repositioning`
**Audit Date:** 2026-11-26

---

## 1. Multi-Viewport Matrix (8 Viewports Verified)

All 8 target viewports passed Playwright automated layout, asset loading, typography floor (`>= 12px` in `main`), and zero-error runtime checks against `LANDING_PAGE_EDITORIAL_ENABLED=true`:

| Viewport | `scrollWidth` / `innerWidth` | Overflow | H1 Size | Hero Asset Selected | Min Font in `main` | Console / Page Errors | Screenshot Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `1440×900` | `1440 / 1440` | `0 px` | `52.5 px` | `two-lights-desktop-10bit.avif` | `12 px` | `0 / 0` | `editorial-1440x900-hero.png`, `editorial-1440x900-full.png` |
| `1280×720` | `1280 / 1280` | `0 px` | `52.5 px` | `two-lights-desktop-10bit.avif` | `12 px` | `0 / 0` | `editorial-1280x720-hero.png` |
| `1024×768` | `1024 / 1024` | `0 px` | `52.5 px` | `two-lights-desktop-10bit.avif` | `12 px` | `0 / 0` | `editorial-1024x768-hero.png` |
| `768×1024` | `768 / 768` | `0 px` | `42.75 px` | `two-lights-desktop-10bit.avif` | `12 px` | `0 / 0` | `editorial-768x1024-hero.png` |
| `430×932` | `430 / 430` | `0 px` | `32.25 px` | `two-lights-mobile-10bit.avif` | `12 px` | `0 / 0` | `editorial-430x932-hero.png` |
| `390×844` | `390 / 390` | `0 px` | `32.25 px` | `two-lights-mobile-10bit.avif` | `12 px` | `0 / 0` | `editorial-390x844-hero.png`, `editorial-390x844-full.png` |
| `375×667` | `375 / 375` | `0 px` | `32.25 px` | `two-lights-mobile-10bit.avif` | `12 px` | `0 / 0` | `editorial-375x667-hero.png` |
| `320×568` | `320 / 320` | `0 px` | `32.25 px` | `two-lights-mobile-10bit.avif` | `12 px` | `0 / 0` | `editorial-320x568-hero.png` |

---

## 2. WCAG Contrast & Keyboard Navigation Audit

| Check | Measured Output | Result |
| --- | --- | --- |
| Skip Link First Focus (`Tab`) | `<a href="#main-content">Skip to main content</a>`, rendered box `156.98 × 37.5 px` | **PASS** |
| Single Primary `<h1>` & Heading Tree | `1` `<h1>`, `19` total semantic headings across sections | **PASS** |
| Roving Focus on `role="tablist"` (`ArrowRight`) | Active focus moves programmatically from `preview-tab-match` to `preview-tab-chat` | **PASS** |
| Mobile Navigation Drawer (`Escape`) | Closes `#mobile-public-drawer` and returns focus to `[aria-label="Open navigation menu"]` | **PASS** |
| `prefers-reduced-motion: reduce` | Verified active in Chromium context (`matchMedia` true; CSS animations suppressed) | **PASS** |
| Contrast — Hero H1 (`#F0F1EE` / `#0B0D10`) | `17.16 : 1` | **PASS (AAA)** |
| Contrast — Subcopy / Body (`#B6BDC4` / `#0B0D10`) | `10.25 : 1` | **PASS (AAA)** |
| Contrast — Iris Eyebrow (`#8580C4` / `#0B0D10`) | `5.45 : 1` | **PASS (AA)** |
| Contrast — Footer Copyright (`#B6BDC4` / `#12161B`) | `5.90 : 1` | **PASS (AA)** |
