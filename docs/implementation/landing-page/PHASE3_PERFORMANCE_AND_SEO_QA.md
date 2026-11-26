# Phase 3: Performance & SEO QA Report

**Project:** SayMyName.in — The First Impression Project
**Branch:** `landing-page-repositioning`
**Measurement Date:** 2026-11-26

---

## 1. Core Web Vitals & Network Budget (Chromium Production Build on `127.0.0.1:3107`)

> **Methodology Note:** Global `lighthouse` CLI is not installed in this environment (`NOT RUN`); metrics below were captured directly from live headless Chromium `PerformanceObserver` & CDP network/CPU telemetry against the production `next start` bundle.

| Metric | Desktop (`1440×900`, Unthrottled Local) | Mobile (`390×844`, CDP 4× CPU + Slow 4G `1.6 Mbps / 150 ms`) |
| --- | --- | --- |
| **TTFB** | `11 ms` | `8 ms` |
| **FCP** | `308 ms` | `1,237 ms` |
| **LCP** | `308 ms` (`IMG` — Hero Two Lights) | `1,237 ms` (`IMG` — Hero Two Lights) |
| **CLS** | `0.0015` | `0.0276` |
| **Total Page Transfer** | `229.9 KB` (`JS`: `149.6 KB`, `Images`: `11.6 KB`) | `206.6 KB` (`JS`: `140.6 KB`, `Images`: `10.1 KB`) |
| **DOM Nodes** | `361` | `365` |
| **Tab Switch Latency** | `94.0 ms` | `243.0 ms` (under 4× CPU slowdown) |

---

## 2. Font, Bundle & Asset Discipline

- **Font Delivery:** Self-hosted variable WOFF2 `Instrument Sans` served locally via `next/font/local`. **0 requests** to `fonts.googleapis.com` or `fonts.gstatic.com`.
- **Two Lights Assets:** Responsive `<picture>` serves `10-bit AVIF` (`1.48 KB` mobile / `2.97 KB` desktop) with explicit dimensions (`width`/`height`) preventing CLS, plus crisp `two-lights-detail.webp` (`8.28 KB`). Uncompressed master PNG is excluded from `public/`.
- **Client Footprint:** First Load JS for `/` is `115 kB` (`103 kB` shared + `3.82 kB` route chunk). Interactive state is strictly isolated to `ProductPreview.tsx`, `ShareSection.tsx`, and `Navbar.tsx`.

---

## 3. SEO & Metadata Status

| Element | Verified Output | Status |
| --- | --- | --- |
| `<title>` | `"SayMyName.in — Intentional dating for verified IIT Madras non-campus BS adults"` | **PASS** |
| `meta[name="description"]` | Present, accurate, Phase 1 scoped | **PASS** |
| `link[rel="canonical"]` | `"https://saymyname.in"` | **PASS** |
| `og:title` / `og:description` | `"SayMyName.in — Same world. Different cities. A chance to meet."` / matching editorial summary | **PASS** |
| `og:image` | Unset (`null`) pending human selection of `DEC-LP-06` (`og-direction-a` vs `og-direction-b`) | **GATED / CLEAN** |
| `/sitemap.xml` & `/robots.txt` | Both served HTTP `200 OK` | **PASS** |
