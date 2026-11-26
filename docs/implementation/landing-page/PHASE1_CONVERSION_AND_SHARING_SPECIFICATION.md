# Phase 1 Conversion, Social Sharing, SEO & Analytics Specification — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Baseline:** `landing-page-repositioning` @ `9e1a58d`  
**Status Rule:** All specifications, attribution tags, metadata, and analytics schemas below are **`PROPOSED — PENDING HUMAN APPROVAL`**. Zero tracking code, analytics SDKs, metadata edits, or sharing UI changes have been implemented in `apps/web`.

---

## 1. Conversion Hierarchy & Primary CTA Choice

### Evaluating the Primary Action (`Create Account` vs `Join SayMyName` vs `Join Cohort`)

| Criterion | **`Create Account`** *(Recommended)* | `Join SayMyName` | `Join Cohort` |
|---|---|---|---|
| **Clarity of Next Screen** | **Highest** — matches `/onboarding` Stage 1 (`"Create your verified account"`) verbatim; visitor knows an explicit registration + verification workflow follows | Warm and brand-aligned, slightly less clear whether clicking starts registration or opens an informational intro | Ambiguous — risks implying immediate club membership or skipping manual age/student verification (`Section 6.1` violation!) |
| **Honest Expectation Setting** | Signals account creation + verification steps transparently | Good, neutral expectation | Weak/misleading if user assumes cohort auto-entry via email suffix |
| **Visual Consistency Across `/` & Auth Flows** | Directly harmonizes Header (`Register` -> **`Create Account`**), Hero (**`Create Account`**), Section 07 (**`Create Account`**), and `/login` footer (`"Create your account →"`) | Forces renaming `/login` & `/onboarding` CTA strings for consistency | Clashes with `Create your verified account` heading inside `/onboarding` |

> **Recommendation (`PROPOSED`):** Standardize **`Create Account`** (`Button variant="primary"`, `Iris #8580C4`, `8px` radius, `48px` height in Hero & Section 07, `38–40px` in Header) across every primary registration surface. Retain `Sign In` strictly for returning members in Header (`/login`), removing duplicate `Member Sign In →` inline clutter from the Hero button cluster.

---

## 2. Full Conversion Journey Specification (`No Underlying Flow Changes`)

```text
Landing Page (/)
     │
     ▼  [Visitor sees Editorial Romance Hero + Product Preview + Transparent Expectations]
Create Account (/onboarding -> view: 'register')
     │
     ├── Friction / Drop-off Check A: Visitor types Gmail or @iitm.ac.in campus mail
     │      └─ Handled cleanly by inline domain error + calm link back to /eligibility
     ▼
Registration (Email + Password >= 8 chars -> POST /api/auth/register)
     │
     ▼  [10-min OTP dispatched via configured Resend inbox; 60s resend cooldown]
Email Verification (/onboarding -> view: 'otp' -> POST /api/auth/verify-otp)
     │
     ▼  [HttpOnly BFF session minted; zero localStorage tokens]
Age & Student Review
     ├─ Step 3: 18+ DOB check (/onboarding -> view: 'age'; <18 blocked 403)
     ├─ Step 4: BS track + optional non-gov proof (/onboarding -> view: 'student')
     ▼
Manual Review Queue (/onboarding -> view: 'review' / VERIFICATION_PENDING)
     │  ── BIGGEST DROP-OFF RISK IF SURPRISED ──
     │  Prepares visitor cleanly on Section 04 that review is manual (not instant),
     │  and invites finishing bio/city/prompt drafts (plus optional peer share) cleanly.
     │
     │  [Authorized human reviewer approves Age + Student cases via ReviewerGuard]
     ▼
Profile Onboarding (/onboarding -> view: 'profile' / PROFILE_INCOMPLETE)
     │  Requires bio/fields, >= 1 private R2 portrait, and guidelines consent (D-P2-04)
     ▼
Profile Publication (POST /api/bff/v1/profiles/me/publish -> ACTIVE_MEMBER)
     │
     ▼
Discover (/discover -> Browse verified peers, Like/Pass, Mutual Match, 1:1 Text Chats)
```

---

## 3. Complete CTA & Interactive Element Inventory

| Section | Element Type | Exact Copy (`PROPOSED`) | Destination | Hierarchy | Notes / Accessibility |
|---|---|---|---|---|---|
| **00 Header** | Logo Lockup Link | `SayMyName` *(aria-label: SayMyName Home)* | `/` | Brand Home | Focus ring `#8580C4` |
| **00 Header** | Text Link | `How It Works` | `/#how-it-works` | Secondary Nav | `scroll-margin-top: 84px`; works from subroutes too |
| **00 Header** | Text Link | `Eligibility` | `/eligibility` | Secondary Nav | Desktop inline + mobile drawer |
| **00 Header** | Text Link | `Safety` | `/safety` | Secondary Nav | Desktop inline + mobile drawer |
| **00 Header** | Utility Link / Button | `Sign In` | `/login` | Secondary Auth | Visible on both mobile top bar & desktop |
| **00 Header** | Button (`primary`, `sm`) | `Create Account` | `/onboarding` | **Primary Nav CTA** | Desktop bar + inside mobile drawer (`min-h-[44px]`) |
| **01 Hero** | Button (`primary`, `lg`) | `Create Account` | `/onboarding` | **Primary CTA** | Full-width `48px` on mobile `<=430px` |
| **01 Hero** | Text Anchor Link | `See how it works ↓` | `#how-it-works` | Secondary Action | Smooth scroll (`instant` when `prefers-reduced-motion`) |
| **03 Product Preview** | Segmented Tabs (`3`) | `01 Discover` / `02 Mutual Match` / `03 Private Chat` | Client state (`aria-selected`) | Interactive UI Switcher | Keyboard arrow/tab accessible; `min-h-[44px]` touch target |
| **03 Product Preview** | Text Link | `Explore how joining works ↓` | `#how-it-works` | Supporting Link | Bridges preview -> onboarding |
| **04 How Joining Works** | Text Link | `Read full eligibility criteria →` | `/eligibility` | Reference Link | Keeps `/` concise while `/eligibility` handles rules |
| **06 Trust & Control** | Text Link | `Read full Safety & Consent Architecture →` | `/safety` | Reference Link | Deep technical/privacy proof (`CTRL-01..06`) |
| **07 Closing Invitation** | Button (`primary`, `lg`) | `Create Account` | `/onboarding` | **Final Primary CTA** | Stands alone cleanly without competing buttons |
| **07 Peer Share Band** | Button (`secondary`, `md`) | `Share SayMyName` *(fallback: `Copy Link`)* | Web Share / Clipboard (`https://saymyname.in/?src=peer`) | Secondary Organic Action | Shows polite `role="status"` toast `"Link copied"` (`3s`) |
| **08 Footer** | Structured Links | `Overview`, `Inside SayMyName`, `How Joining Works`, `Eligibility Guide`, `Safety & Consent`, `Member Sign In`, `Create Account`, `Password Recovery`, `Privacy Notice`, `Terms of Use`, `Member Support` | Respective existing routes & `#` anchors | Footer Utility | `PublicFooter.tsx`; zero dead URLs |

*Verification Check:* **Zero** decorative non-working buttons exist anywhere in the inventory (`Discover`/`Match`/`Chat` preview tabs visibly label illustrative controls as non-interactive sample UI).

---

## 4. Natural Community Sharing & Peer-Growth Specification

### A. User Experience (`Section 07B` — Low-Friction Peer Introduction)
- **Trigger:** Calm secondary action `Share SayMyName` beside Section 07 Closing Invitation.
- **Native Flow:** Calls `navigator.share({ title, text, url: 'https://saymyname.in/?src=peer' })` when supported (Android Chrome, iOS Safari, modern Edge/macOS); gracefully falls back to `navigator.clipboard.writeText('https://saymyname.in/?src=peer')` with non-intrusive status confirmation (`"Link copied—send quietly to an eligible BS peer"`).
- **Explicit Ethical Constraints:**
  - Zero referral credits, skip-the-queue bribes, streak counters, or Discover locks.
  - Zero contact-book access, zero bulk messaging integrations, zero member attribution exposing who invited whom.
  - Clear inline eligibility note (*"For 18+ adults in IIT Madras non-campus BS programmes"*).

### B. Social Share Card & OpenGraph Preview Spec (`1200 × 630 px`)
Because IITM BS students communicate primarily via **WhatsApp**, **Telegram**, and **Discord**, the **static/generated OpenGraph image (`/og-saymyname.png`)** acts as the true storefront for peer referrals:
- **Dimensions & Format:** `1200 × 630 px` PNG (plus JPEG fallback if size exceeds `300 KB` WhatsApp preview threshold — test in Phase 2!).
- **Visual Composition:** Dark *Mineral Night* canvas (`Void #0B0D10 -> Coal #12161B` subtle vignette), centered-left **SayMyName Interval Lockup** (`SayMyName` grotesk wordmark + Interval Symbol), right-hand cropped detail of **`3D-01` (*Two Lights Across the Interval* warm Ember aperture)** — clean `>80px` outer safe margins so WhatsApp square-thumbnail auto-cropping (`center 630×630`) keeps headline & warm Interval mark readable!
- **Card Copy (`PROPOSED`):**
  - Headline inside visual card: `Same world. Different cities. A chance to meet.`
  - Supporting line: `Dating for verified 18+ IIT Madras non-campus BS students.`
  - Footer corner url: `saymyname.in` *(Zero IITM crest, zero member counters, zero clickbait badges)*.
- **Platform Behaviour Checklist:**
  - *WhatsApp:* Renders crisp thumbnail/large banner + `og:title` (`<= 60` chars) + concise `og:description`.
  - *X / Twitter:* `twitter:card = "summary_large_image"` showing full `1200 × 630` composition.
  - *Mobile Link Previews:* High contrast (`Chalk #F0F1EE` on `#0B0D10`) readable even in WhatsApp dark & light themes.

### C. Source Attribution (`?src=peer`)
- **Recommended Parameter:** `?src=peer` (lightweight plain label without user IDs or tracking tokens).
- **Governance Rule:** **Do NOT store `?src=peer` per-user in PostgreSQL identity records or expose referrer graphs** unless separately reviewed. Count solely as an aggregate session origin bucket (`direct` vs `peer`) under approved Decision 5 analytics.

---

## 5. SEO & Route Metadata Specification (`Phase 2 Prerequisite`)

Phase 0 found identical `<title>` values across every route, zero OpenGraph/canonical tags, and `HTTP 404` on `/sitemap.xml`.

### Homepage (`/`) Target Metadata (`PROPOSED`)
- **Canonical URL:** `https://saymyname.in` (via `metadataBase: new URL('https://saymyname.in')`)
- **`<title>` (`58 chars`):** `SayMyName.in — Dating for IIT Madras Non-Campus BS Adults`
- **`<meta name="description">` (`153 chars`):** `An independent dating space for verified adults (18+) enrolled in IIT Madras’s four non-campus BS programmes. Mutual interest, thoughtful profiles, private chat.`
- **`og:title`:** `SayMyName — Same world. Different cities. A chance to meet.`
- **`og:description`:** `An intentional dating platform for verified 18+ IIT Madras non-campus BS students. Discover peers beyond study channels and chat after a mutual match.`
- **`og:type`:** `website` | **`og:url`:** `https://saymyname.in` | **`og:site_name`:** `SayMyName.in`
- **`og:image`:** `https://saymyname.in/og-saymyname.png` (`1200×630`, alt: `SayMyName dark architectural Interval mark with headline Same world. Different cities. A chance to meet.`)
- **`twitter:card`:** `summary_large_image` (`twitter:title` & `twitter:description` matching `og:*`)
- **Crawl & Index Route Fixes (`Phase 2`):**
  - Add per-route `metadata` on `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`, `/login`, `/onboarding` (`robots: { index: false, follow: true }` on auth/onboarding utility states like `/reset-password` and `/forgot-password`, `index: true` on public content routes).
  - Add `apps/web/app/sitemap.ts` listing public static routes (`/`, `/eligibility`, `/safety`, `/privacy`, `/terms`, `/support`, `/login`, `/onboarding`) and `apps/web/app/robots.ts` blocking authenticated app shells (`/discover`, `/likes`, `/matches`, `/chats`, `/profile`, `/api/*`).

---

## 6. Privacy-Preserving Aggregate Analytics Specification (`Pending Approval`)

### Minimum Viable Funnel Events (Cookie-Less, Aggregate Only)
Phase 0 suggested 5 events (`lp_hero_viewed`, `lp_section_seen`, `lp_cta_clicked`, `lp_share_clicked`, `onboarding_stage_entered`). Assessment for Phase 1 MVP: **start with the `3` essential conversion actions + `1` landing denominator (`4` events max, zero scroll-spy noise required on launch)**:

| Event Name | Trigger | Allowed Non-PII Properties | Purpose |
|---|---|---|---|
| `lp_page_viewed` | Client mount on `/` (1x per visit) | `viewport_tier` (`mobile`\|`tablet`\|`desktop`), `src` (`peer`\|`direct`) | Denominator for true conversion & mobile-vs-desktop balance |
| `lp_cta_clicked` | Click on `Create Account`, `See how it works`, or `Sign In` | `cta_slot` (`hero_primary`\|`hero_secondary`\|`header_primary`\|`closing_primary`), `viewport_tier` | Compares Hero vs Closing vs Header CTA pull |
| `lp_share_clicked` | Click on `Share SayMyName` (`Section 07B`) | `method` (`web_share`\|`clipboard`) | Measures organic peer-introduction intent |
| `onboarding_stage_entered` | Landing on `/onboarding` stage transitions (`register`, `otp`, `age`, `student`, `review`, `profile`) | `stage_name` ONLY (zero account ID, email, track, DOB, or failure message) | Identifies which post-click onboarding step drops visitors |

### Privacy, Consent & Retention Boundaries
- **Cookies Required?** **No.** Must operate strictly **without advertising cookies, cross-site identifiers, fingerprinting, or persistent browser tracking IDs**. Prefer either server-side aggregate counter increment in Postgres (`daily_funnel_aggregates` table without user FKs!) or an approved EU/India-compliant cookie-less telemetry collector.
- **Strictly Prohibited Collection:** IP addresses stored verbatim, device fingerprints, email addresses, DOBs, BS tracks, photos, Discover swipe targets, match IDs, message content, or raw referral chains.
- **Retention & Legal Approval Gate:** Aggregate daily bucket counts retained max `90–180` days; **cannot be implemented in production without Human Decision 5 sign-off and formal legal counsel verification** (`Document 01 §01` — DPDP Act + IT Rules readiness).
