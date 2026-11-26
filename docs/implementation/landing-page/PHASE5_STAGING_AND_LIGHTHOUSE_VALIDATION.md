# Phase 5: Staging, Dual Build & Performance Validation

**Project:** SayMyName.in — The First Impression Project
**Candidate Commit Verified:** `1cfc3e2f1c94e0f5236682460610f63976738d0d`
**Audit Date:** `2026-11-26`

---

## 1. Dual Production Build Provenance & Parity

| Build | Source Commit | Flag Env Value | Timestamp | Build Result | `○ /` Bundle |
| --- | --- | --- | --- | --- | --- |
| **Build A (Legacy Default)** | `1cfc3e2f1c94e0f5236682460610f63976738d0d` | `LANDING_PAGE_EDITORIAL_ENABLED=false` | `2026-11-26T19:06:29+05:30` | **PASS** (`32/32` routes) | `3.82 kB` / `115 kB` First Load JS |
| **Build B (Release Candidate)** | `1cfc3e2f1c94e0f5236682460610f63976738d0d` | `LANDING_PAGE_EDITORIAL_ENABLED=true` | `2026-11-26T19:07:24+05:30` | **PASS** (`32/32` routes) | `3.82 kB` / `115 kB` First Load JS |
| **Workspace Safety Restore** | `1cfc3e2f1c94e0f5236682460610f63976738d0d` | `LANDING_PAGE_EDITORIAL_ENABLED=false` | `2026-11-26` (post-QA) | **PASS** | Default `.next` restored disabled |

---

## 2. Staging & Lighthouse Status (Honest Limitations)

- **Remote Staging Environment:** **`NOT RUN`** — No authorized staging deployment URL or CI deployment pipeline exists inside this workspace (`.github/` contains empty directory scaffolding only; no `render.yaml` or `gh` CLI authenticated). No paid hosting service was provisioned.
- **Lighthouse CLI:** **`NOT AVAILABLE / NOT RUN`** — Checked `Get-Command lighthouse` and `npx --no-install lighthouse --version` (not installed locally or in `.github/` workflows). No external npm packages were installed and no Lighthouse category scores are fabricated.
- **Equivalent Production-Build Verification Completed:** Executed live headless Chromium `PerformanceObserver` and CDP Mobile Slow-4G throttling audits against the real compiled `next start` candidate server (`127.0.0.1:3110` & `127.0.0.1:3111`).

---

## 3. Measured Chromium Core Web Vitals & Network Metrics

| Metric | Target | Flag Disabled (`1440×900`) | Flag Enabled (`1440×900` Cold) | Flag Enabled (`390×844` CDP 4× CPU + Slow 4G `1.6 Mbps / 150 ms`) |
| --- | --- | --- | --- | --- |
| **TTFB** | — | `10 ms` | `6 ms` | `5 ms` |
| **FCP** | `<= 1.8 s` | `326 ms` | `247 ms` | `896 ms` |
| **LCP** | `<= 2.5 s` | `326 ms` (`H1`) | `247 ms` (`IMG` Two Lights) | `896 ms` (`IMG` Two Lights) |
| **CLS** | `<= 0.1` | `0.0003` | `0.0014` | `0.0276` |
| **Long Tasks (`>50ms`)** | Minimal | `2` | `2` | `4` (under 4× CPU throttle) |
| **Total Transfer** | Compact | `218.3 KB` | `229.9 KB` | `206.6 KB` |
| **JS / Img / Font Transfer** | Minimal | `149.6 / 0 / 40.9 KB` | `149.6 / 11.6 / 40.9 KB` | `140.6 / 10.1 / 40.9 KB` |
| **DOM Nodes** | Compact | `289` | `364` | `370` |

---

## 4. Accessibility, Route Regression & Privacy Confirmation

- **Phase 4 Minor Polish Closed:** Mobile visitor drawer toggle (`Navbar.tsx`) verified at `44 × 44 px` bounding box (`x: 334.75, y: 11, w: 44, h: 44`); Editorial footer typography (`PublicFooter.tsx`) verified `>= 12 px` (`minFontBody: 12` across all `<main>` and `<footer>` copy on every viewport).
- **8-Viewport Check (`1440×900` down to `320×568`):** `0 px` horizontal overflow, `0` broken images, `0` console/page/HTTP errors.
- **SEO & Metadata:** Verified `og:image` and `twitter:image` resolve cleanly to `https://saymyname.in/images/landing/og/saymyname-og-direction-a.png` (`200 OK`); `/sitemap.xml` and `/robots.txt` return `200 OK`; `/login`, `/onboarding`, `/forgot-password`, and `/reset-password` preserve `noindex`.
- **Protected & Security Boundaries:** Unauthenticated `/discover`, `/likes`, `/matches`, `/chats`, `/profile` redirect `307` -> `/login?returnUrl=...`; `0` secret/R2/`?src=peer` matches in SSR DOM. Physical screen-reader audio playback (NVDA/VoiceOver) remains not performed.
