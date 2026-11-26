# Phase 0 Conversion, Funnel & Community Growth Audit — SayMyName.in

**Workstream:** The First Impression Project — Landing Page Repositioning & Conversion Redesign  
**Phase:** 0 of 6 (Research, Audit & Discovery)  
**Baseline Traced:** `apps/web/app/{page.tsx, register/page.tsx, onboarding/page.tsx, login/page.tsx, eligibility/page.tsx, safety/page.tsx}` + `Navbar.tsx` + `auth-context.tsx`

---

## 1. End-to-End Funnel Trace (`Visitor -> Active Member in Discover`)

> **Epistemic Tag:** *[Observed Fact — Codebase & Route Inspection]*

Tracing every concrete screen and state transition an eligible IITM BS learner currently passes through from first arrival on `/` until sending their first Like in `/discover`:

| Stage | Route / State | User Effort & Waiting Reality | Observed Conversion Friction / Drop-Off Risks | Priority |
|---|---|---|---|---|
| **0. Arrival & Impression** | `/` | `~5–10s` first impression | Hero wireframe (`v1.0`) + `"Default-deny access before Discover"` frames product as a gated compliance portal with zero visible dating reward. Mobile `375px` pushes visual completely off-screen. Zero OG preview when shared via WhatsApp/Telegram. | `P0` |
| **1. CTA Decision** | `/` or `Navbar` | Choose among `5` links (`Register`, `Sign In`, `Create Account`, `Explore Eligibility`, `Member Sign In →`) | Naming mismatch (`Register` vs `Create Account` vs `/onboarding`). Visitors click `Explore Eligibility` or bounce before committing because `/` never previews Discover/Prompts/Chats. | `P0` |
| **2. Account Form** | `/onboarding` (`view: 'register'`) | `@study.iitm.ac.in` / `@ds.study.iitm.ac.in` / `@es.study.iitm.ac.in`, password `>= 8`, confirm password, optional display name | Long onboarding URL (`/onboarding`) feels abrupt for first-time registration; email rule warning (`Only approved IITM BS domains...`) appears sharply on submit if they typed personal Gmail by habit before understanding why. (`RESEND_API_KEY` + verified domain DNS required in env!) | `P1` |
| **3. Inbox OTP** | `/onboarding` (`view: 'otp'`) | Leave browser, check IITM BS student inbox, enter 6-digit OTP (`10m` expiry, `60s` resend cooldown) | Inbox delivery latency or spam-folder filtering at `@study.iitm.ac.in` creates multi-minute abandonment risk if user isn't excited enough about what waits inside. | `P1` |
| **4. Strict 18+ Check** | `/onboarding` (`view: 'age'`) | Submit `YYYY-MM-DD` DOB (`<18` blocked `403`, `>=18` sets `ageStatus: 'pending'`) | Clear & mandatory (`AGE-01`). Copy references internal citations (`"Document 01 §3.5"`) in the live UI card, which feels slightly bureaucratic to normal students. | `P2` |
| **5. BS Track Case** | `/onboarding` (`view: 'student'`) | Select 1 of 4 BS tracks, `Foundation`/`Diploma`/`Degree`, optional non-gov-ID proof (`student_enrolment_letter` / `iitm_portal_screenshot` / `term_fee_receipt`) -> R2 upload | Requires locating portal screenshot or term receipt (optional but creates perceived homework). | `P1` |
| **6. Manual Review Wait (`THE BIGGEST GAP`)** | `/onboarding` (`view: 'review'`, `VERIFICATION_PENDING`) | **Asynchronous human ops wait** until `POST /api/v1/verification-cases/:id/decision` approves both Age & Student cases (`discoveryEligible: true`) | Because SayMyName legally & safely prohibits auto-approval in production (`ADR-017`), newly signed-up students **cannot enter Discover immediately**! Today `/` never prepares visitors warmly for this calm 1-time human check or gives them an attractive reason to finish their photo-less profile draft while waiting. | `P0` |
| **7. Profile Builder & R2 Portrait** | `/onboarding` (`view: 'profile'`, `PROFILE_INCOMPLETE`) | Complete 5-tab guided profile (identity, bio, interests/prompt, `>= 1` private R2 portrait, consent checkbox) -> `Publish` | Good structured design (`D-P2-04`); needs clear upfront reassurance on `/` that photos live in private R2 storage and coarse city/state protects privacy. | `P1` |
| **8. Discover Entry** | `/discover` (`ACTIVE_MEMBER`) | Browse real peers, Like / Pass, Likes Inbox -> Mutual Match -> `Chats` | High reward once inside, completely hidden from the public `/` visitor today. | `P0` |

---

## 2. CTA Architecture & Micro-Copy Audit

| Surface | Current CTAs & Targets | Problem Diagnosis | Recommended Direction | Priority |
|---|---|---|---|---|
| **Sticky Navbar** | `Eligibility Guide`, `Safety & Consent`, `Sign In`, `Register` | Top links foreground rules (`Eligibility`, `Safety`) instead of product value; `Register` mismatches Hero `Create Account`. | Use approachable value + trust links (`How It Works`, `Eligibility`, `Safety`) + concise `Sign In` and unified primary verb (`Create Account` or `Join Cohort`). Keep header calm (`<= 5` items). | `P1` |
| **Hero CTA Cluster** | `Create Account` (`primary`) + `Explore Eligibility` (`secondary`) + `Member Sign In →` (`ghost`) | **3 buttons side-by-side** violates Hick's Law on mobile (`3` stacked lines at `375px`!), creates choice paralysis, and encourages high-intent visitors to detour into `/eligibility` first. | Keep **1 dominant Primary CTA** (`Create Account` or `Join SayMyName` -> `/onboarding`) + **1 quiet text link** (`See how it works ↓` smooth scroll OR subtle `Already a member? Sign in` for returning users). Move `Explore Eligibility` to lower Cohort section! | `P0` |
| **Section-End / Bottom Closure** | Section 4 has `Review Safety Architecture` (`/safety`); **no final bottom conversion CTA exists above footer!** | A visitor who scrolls all the way through `/`, becomes convinced of SayMyName's values, and reaches the footer finds **zero final conversion button** to join! | Place a calm **Closing Invitation band** before the footer combining: (1) primary `Create Account` action + (2) effortless **Share with an eligible BS peer** action. | `P0` |

---

## 3. Natural Community Sharing & Peer-Growth Loop (`Respecting All Boundaries`)

In a niche university-cohort dating product (`Phase 1` IITM BS), paid mass advertising wastes spend on ineligible non-BS audiences, whereas **peer-to-peer word of mouth** inside study groups, WhatsApp circles, hostel-exam meetups, and Discord servers reaches 100% eligible adults naturally—**if** sharing feels classy rather than desperate.

### Proposed Low-Friction, High-Dignity Sharing Mechanism
1. **Dynamic Rich OpenGraph Preview (`og:title`, `og:description`, `og:image` 1200×630 dark editorial card) — `P0`:**
   - *What:* Whenever anyone shares `https://saymyname.in` in WhatsApp, Telegram, Discord, or Instagram DM, it renders an evocative dark *Mineral Night* card (`"SayMyName — Same world. Different cities. A chance to meet."`, subtle IITM BS adult cohort context, zero cringey stock hearts or IITM logo impersonation).
   - *Why it matters:* Today (`a11y_dom` / `audit_metrics.json`), `og:*` tags do not exist, making shared links look like a plain unfinished URL.
2. **Tasteful Public Section: *"Built for a shared world—help it feel inhabited"* (`Share / Copy Link` action) — `P1`:**
   - *What:* A calm utility card near the bottom of `/` (and optionally post-onboarding in `/onboarding` review waiting screen!): *"Know a friend in the IITM BS cohort who might like a calmer way to meet peers?"* + single `Copy Invite Link` / native `navigator.share` button with subtle confirmation toast.
   - *Why (Berger & Milkman, 2012):* Positive identity resonance + low-friction social utility drives organic sharing without social embarrassment, especially when framed around building a **better mutual cohort** (solves cold-start liquidity transparently without fake member counts!).
3. **Optional Campaign UTM Attribution Only (`?ref=peer` or `?src=cohort` — Privacy-Preserving) — `P2`:**
   - *Design Rule:* Strictly aggregate campaign source (`src=share_card`), **NEVER** exposing individual referrer-to-referee dating links, invite codes tied to personal match visibility, "invite 3 friends to unlock Discover" paywalls/bribes (`MATCH-25` & anti-coercion rules!), or automated contact-list scraping (`security-privacy.md`).

### Guardrails for Growth Loop (Non-Negotiable Compliance)
- ❌ **NO** forced referral gates (*"Invite 2 peers to skip verification"* — violates `VER-01`/`AGE-01` & anti-coercion rules).
- ❌ **NO** reward streaks, point leaderboards, or contact-book harvesting.
- ❌ **NO** IIT Madras crest/logo on share cards or messaging implying official campus affiliation (`D-01`).
- ✅ **Clear non-tracking sharing:** Web Share API + `navigator.clipboard.writeText` with plain `https://saymyname.in/?src=peer` (optional aggregate tag only).

---

## 4. Privacy-Safe Conversion Measurement & Analytics Gap

*[Observed Fact — `apps/web/package.json` & Source Inspection]*

Currently `apps/web` has **zero analytics (`0` packages, `0` events)** — making it impossible to measure whether a homepage redesign increases `/onboarding` starts, reduces early abandonment, or changes peer-share traffic. (Only Cloudflare edge insights `beacon.min.js` / `/cdn-cgi/rum` appeared at runtime on `https://saymyname.in`.)

### Proposed Minimal, DPDP-Aligned Funnel Telemetry (No Surveillance, No Dark Patterns)
Before implementing landing-page experiments (Phases 2–5), ask human approval on adding **strictly anonymous, non-PII, non-message-content, cookie-less / privacy-preserving funnel events** (`Document 05` / `security-privacy.md` compliant — **no third-party ad pixels**, no Meta/Google Ads retargeting, zero logging of emails/DOBs/photos/chats):

| Funnel Event Name | Trigger Point | Strict Non-PII Properties Allowed | What Decision It Unlocks |
|---|---|---|---|
| `lp_hero_viewed` | `/` initial load (`viewport` bucket only: `mobile`/`tablet`/`desktop`) | `viewport_tier`, `utm_source` (`peer`/`direct`) | Separates mobile vs desktop bounce rates |
| `lp_section_seen` | IntersectionObserver (`50%` dwell) for key sections | `section_id` (`product_preview`, `how_it_works`, `tracks`, `trust`, `invite`) | Measures scroll depth & where visitors stop reading |
| `lp_cta_clicked` | Click on Hero/Bottom/Nav CTA | `cta_slot` (`hero_primary`, `hero_secondary`, `footer_join`, `nav_signin`) | Proves which CTA framing converts without guessing |
| `lp_share_clicked` | Click on `Copy Invite Link` / `Share SayMyName` | `method` (`web_share` \| `clipboard`) | Measures peer-to-peer share intent directly |
| `onboarding_stage_entered` | Transition across `/onboarding` states (`register` -> `otp` -> `age` -> `student` -> `review` -> `profile`) | `stage_name` ONLY (zero PII, zero DOB, zero email, zero track/case IDs) | Pinpoints exact onboarding drop-off step after clicking Hero CTA |

- **Storage / Architecture:** Server-side aggregate event endpoint or self-hosted/privacy-safe analytics approved in writing before Phase 2; respect `Do Not Track` / consent boundaries cleanly under pre-launch legal counsel review (`Doc 01 §01`).
- **What Must Be Measured Before Picking a Winner:**
  1. **Primary metric:** `%` of anonymous `/` sessions clicking Primary CTA **AND** completing `/onboarding` Step 1 (`register` + `otp` confirmed) — guarding against clickbait headlines that drive hollow bounces at `/onboarding`!
  2. **Secondary metric:** Onboarding completion readiness (`review` + `profile` draft completed) & `lp_share_clicked` rate.
  3. **Guardrail metrics:** Ineligible domain error rate (`4xx` on `@gmail.com` sign-ups — checks if copy stays clear enough that non-IITM visitors don't waste effort), mobile LCP `< 2.5s`, CLS `< 0.1`.
