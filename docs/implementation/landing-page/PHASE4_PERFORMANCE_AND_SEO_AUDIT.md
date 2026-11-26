# Phase 4: Performance & SEO Release Audit

**Project:** SayMyName.in — The First Impression Project
**Branch:** `landing-page-repositioning`
**Audit Candidate Commit:** `7aebe0397a374e35c975597c18d3e9d2083f01e7`

---

## 1. Methodology & Lighthouse Availability Statement

- **Lighthouse CLI Check:** Checked `Get-Command lighthouse` and `npx --no-install lighthouse --version` -> **`lighthouse` is NOT installed globally or in workspace packages**. No external dependency was installed solely for reporting, and **zero synthetic Lighthouse category scores are claimed**.
- **Actual Method Used:** Live Chromium DevTools Protocol (CDP) + `PerformanceObserver` instrumentation executed against production `next start` builds (`http://127.0.0.1:3108` for disabled state; `http://127.0.0.1:3109` for enabled state) on `1440×900` (unthrottled local desktop) and `390×844` (CDP 4× CPU slowdown + Slow 4G network profile: `1.6 Mbps` download, `750 Kbps` upload, `150 ms` RTT).

---

## 2. Measured Telemetry vs Phase 4 Performance Targets

| Metric | Target | Flag Disabled (`1440×900` Cold) | Flag Enabled (`1440×900` Warmed Context) | Flag Enabled (`390×844` Cold Slow-4G + 4× CPU) | Target Comparison |
| --- | --- | --- | --- | --- | --- |
| **TTFB** | — | `9 ms` | `7 ms` | `6 ms` | Localhost static HTML fast |
| **FCP** | `<= 1.8 s` | `361 ms` | `135 ms` | `1,172 ms` | Within target under Slow 4G |
| **LCP** | `<= 2.5 s` | `361 ms` (`H1`) | `135 ms` (`IMG`) | `1,172 ms` (`IMG`) | **`1.17 s <= 2.5 s` target** |
| **CLS** | `<= 0.1` | `0.0003` | `0` | `0.0276` | **Well below `0.1` target** |
| **Long Tasks (`>50ms`)** | Minimal | `2` | `0` | `3` | Under 4× CPU mobile throttle |
| **Total Transfer** | Compact | `218.3 KB` | `34.9 KB` *(HTTP cache)* | `206.6 KB` | Cold mobile total `< 210 KB` |
| **JS Transfer** | Compact | `149.6 KB` | `3.5 KB` *(HTTP cache)* | `140.6 KB` | Route first-load JS `115 KB` |
| **Image Transfer** | Minimal | `0 KB` | `0.6 KB` *(HTTP cache)* | `10.1 KB` | Responsive AVIF + WebP `< 11 KB` mobile |
| **Font Transfer** | Self-hosted | `40.9 KB` | `0 KB` *(HTTP cache)* | `40.9 KB` | Self-hosted `Instrument Sans` WOFF2 |
| **DOM Nodes** | Compact | `283` | `365` | `365` | Clean, low DOM footprint |
| **Lighthouse Scores** | `90+ / 95+` | **NOT RUN** *(CLI unavailable)* | **NOT RUN** *(CLI unavailable)* | **NOT RUN** *(CLI unavailable)* | Run in staging CI before release cutover |

*(Note: In Phase 3 uncached localhost measurement prior to `7aebe03`, Desktop `1440×900` cold transfer was `229.9 KB` with `308 ms` LCP and `94.0 ms` tab click latency; Phase 4 Mobile Slow-4G cold transfer confirms `206.6 KB` with `10.1 KB` image payload.)*

---

## 3. SEO, Social Sharing & Indexing Verification

| Surface | Verified Value (`127.0.0.1:3108` & `127.0.0.1:3109`) | Status |
| --- | --- | --- |
| `<title>` | `"SayMyName.in — Intentional dating for verified IIT Madras non-campus BS adults"` | **PASS** |
| `meta[name="description"]` | `"An independent dating-first community for verified adults (18+) currently enrolled in IIT Madras non-campus BS programmes. Mutual interest before conversation."` | **PASS** |
| `link[rel="canonical"]` | `"https://saymyname.in"` | **PASS** |
| `og:title` / `og:description` | `"SayMyName.in — Same world. Different cities. A chance to meet."` / factual editorial summary | **PASS** |
| `twitter:card` | `"summary_large_image"` | **PASS** |
| `og:image` / `twitter:image` | Unset (`null`) — intentionally deferred until `DEC-LP-06` human selection; social shares display rich title/description text without broken image links | **GATED / SAFE** |
| `/sitemap.xml` | HTTP `200 OK` — lists `/`, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support` | **PASS** |
| `/robots.txt` | HTTP `200 OK` — `Allow: /`, `Disallow: /api/, /discover, /likes, /matches, /chats, /profile`, `Sitemap: https://saymyname.in/sitemap.xml` | **PASS** |
| Auth `noindex` Routes | `/login` (`noindex, follow`), `/onboarding` (`noindex, follow`), `/forgot-password` (`noindex, nofollow`), `/reset-password` (`noindex, nofollow`) | **PASS** |
| Social Sharing Attribution | `ShareSection` shares/copies clean `https://saymyname.in`; `0` `?src=peer`, `0` cookies, `0` analytics scripts | **PASS (`DEC-LP-05` compliant)** |
