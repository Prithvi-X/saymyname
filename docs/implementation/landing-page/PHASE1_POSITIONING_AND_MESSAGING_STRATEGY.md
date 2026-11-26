# Phase 1 Positioning & Messaging Strategy — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Baseline:** `landing-page-repositioning` @ `9e1a58d`  
**Status:** `PROPOSED — HUMAN APPROVAL REQUIRED` (Zero copy or strategic choices below are finalized until approved).

---

## 1. Category Definition & 5-Second Clarity

**Phase 0 Defect:** Today, `saymyname.in` forces visitors to decode `"THE INTERVAL ARCHITECTURE v1.0"` and `"Default-deny access before Discover"` to figure out what the product actually does. Even phrases like `"personal connection"` or `"distance bridged by verified gates"` read like an alumni network or academic mentorship portal.

**Category Rule (Non-Negotiable):** Within **5 seconds**, an unfamiliar visitor must know without guessing:
1. **What it is:** A **dating platform** for real romantic connection (`Document 01 D-03`: *"dating-first; no generic social network repositioning"*).
2. **Who it is for:** Verified adults aged **18+** currently enrolled in the **four approved IIT Madras non-campus BS programmes**.
3. **Why it exists:** Distributed BS learners study across dozens of Indian cities without a traditional hostel/campus social fabric.

### Category Descriptor Evaluation
| Descriptor Candidate | Clarity as Dating | Audience Accuracy | Tone Fit (*Editorial Romance*) | Assessment |
|---|---:|---:|---:|---|
| `"A dating space for the IIT Madras BS community"` | High (`"dating space"`) | Clear cohort; pairs cleanly with `18+` & `non-campus` in line 1 of subcopy | Grounded, calm, mature | **RECOMMENDED** (`Eyebrow / Category Line`) — explicit, warm, non-hyperbolic |
| `"Dating for the IITM BS community"` | High (`"Dating"`) | Slight ambiguity if acronym `IITM BS` isn't paired with `non-campus 18+` nearby | Direct, functional, slightly utilitarian | **Strong Mobile/Compact variant**; expand in subcopy |
| `"A more personal way to meet people across the IITM BS community"` | Low-Medium (`"meet people"` risks sounding like study-partner networking) | Clear cohort | Warm editorial voice | **REJECTED for top hero label** — too ambiguous unless paired beside explicit `"dating"` wording |

> **Recommended Category Statement (`PROPOSED`):**  
> Eyebrow: **Dating for verified 18+ IIT Madras BS students** *(compact, unmistakable)* — supported immediately in Hero subcopy line 1 by *"An independent dating space for verified adults (18+) currently enrolled in IIT Madras's four non-campus BS programmes."*

---

## 2. Strictly Bounded Audience Definition

Per `Document 01 §03`, `DECISION_REGISTER` (`D-01`, `D-02`, `D-P2-03`), and `packages/validation/src/eligibility.ts`:

- **Eligible (`18+` Current Students Only):** Adults aged **18 or older** actively enrolled in `Foundation`, `Diploma`, or `Degree` level of:
  1. **BS in Data Science and Applications**
  2. **BS in Electronic Systems**
  3. **BS in Aeronautics and Space Technology**
  4. **BS in Management and Data Science**
- **Explicit Exclusions (Do Not Soften or Blur):** Under-18 learners (regardless of BS admission), regular campus-only IITM students (`@iitm.ac.in` / `@smail.iitm.ac.in`), alumni, discontinued students, qualifier-only applicants, NPTEL/MOOC learners, and students from other universities.
- **Boundary Copy Discipline:**
  - The audience boundary belongs clearly in the Hero category/subcopy and Section 05 (*The Shared Community*), **never** framed as intimidating security warnings (`"Out of Scope: Rejected"` belongs on `/eligibility`, not Hero).
  - Always state plainly that SayMyName.in is **independent** and not owned, operated, or endorsed by IIT Madras.
  - Always state plainly that an `@study.iitm.ac.in` email starts onboarding; **active Discover access requires manual 18+ age and BS enrolment review**.

---

## 3. Core Value Proposition Alternatives & Weighted Evaluation

To prevent prematurely locking into Phase 0's headline slogan without testing strategic alternatives, we evaluate **three genuinely distinct positioning strategies** across different emotional levers.

### Positioning Direction 1: *Shared Geography & Quiet Recognition* ("Editorial Distance Romance")
- **One-Sentence Positioning Statement:** *SayMyName is the independent dating space where adults across IIT Madras's non-campus BS programmes can discover peers in different cities who already share their world.*
- **Primary Audience:** `Segments A & E` (distributed standalone BS learners studying from home cities across India & peer referrals), alongside `Segments B & C` seeking thoughtful adult connection.
- **Emotional Value:** Counteracts the quiet invisibility of remote degrees (*"same exams, different cities"*); creates immediate curiosity about who else shares this specific rhythm across the country.
- **Practical Value:** Curated `Discover` profiles (`display name`, `city/state`, `BS programme`, `prompts`), mutual likes (`Likes` / `Matches`), and focused `1:1` text chat without noisy city-wide stranger pools.
- **Differentiator:** Built specifically for a **geographically scattered shared academic world**, uniting verified cohort belonging with calm, non-gamified mutual consent.
- **Proof Points (Verified `9e1a58d`):** 4-track cohort scope, `Discover` prompt-rich profiles with coarse `city, state`, `Likes` & `Matches` separation, manual 18+ & BS review, private R2 portraits.
- **Main Risk:** Romantic focus on `"different cities"` may make visitors near one's city wonder if local peers are also discoverable, OR may under-highlight *dating* inside the headline itself if the eyebrow/subcopy is weak.
- **Where It Fits:** **Entire Page Backbone** — Hero -> *Across Cities & Screens* -> Product Preview -> Community -> Closing Invitation.

### Positioning Direction 2: *Intentional Peer Dating Beyond Study Channels* ("Community Insider & Authenticity")
- **One-Sentence Positioning Statement:** *SayMyName gives adult IIT Madras non-campus BS students a dedicated, mutual-consent dating platform beyond noisy Discord servers, WhatsApp groups, and campus-only apps.*
- **Primary Audience:** `Segments B & D` (dual-degree learners and privacy-sensitive women active on course groups who never want unsolicited DMs in study spaces).
- **Emotional Value:** Relief and dignity — separating romantic interest from academic WhatsApp/Discord channels so expressing interest carries zero classroom awkwardness unless both match.
- **Practical Value:** Structured profiles with conversation prompts + strict *"Like is never a DM"* mutual gate + instant block/unmatch isolation.
- **Differentiator:** Solves the real social awkwardness of liking someone inside an online degree cohort where study groups are public and unsolicited DMs cross boundaries.
- **Proof Points:** Mutual match gate (`CTRL-02`), zero public directory/feed, non-identifier display names (`isPrivateIdentifierLike`), `Likes` withdrawability.
- **Main Risk:** Emphasizing *"beyond Discord/WhatsApp"* slightly anchors to negative friction and could feel smaller/more utilitarian than **Editorial Romance** aspiration.
- **Where It Fits:** Ideal **Hero Option B** and **Supporting Narrative in Section 02 (*Across Cities & Screens*) & Section 06 (*Trust*)**.

### Positioning Direction 3: *Unhurried Conversations, Not Swipe Fatigue* ("Anti-Gamification Editorial Depth")
- **One-Sentence Positioning Statement:** *SayMyName replaces endless swipe decks and cold small talk with unhurried, prompt-led dating inside a verified adult BS peer community.*
- **Primary Audience:** `Segment C` (older career-switchers / working professionals `23–35+`) and `Segment B` students fatigued by Hinge/Tinder/Bumble swipe loops.
- **Emotional Value:** Composed maturity and psychological ease — dating without popularity scores, read-receipt anxiety, countdowns, or superficial impulse swiping.
- **Practical Value:** Single-card deliberate `Discover` inspection, written prompts + bio + shared interests, calm `Likes` inbox review, direct `1:1` match chat.
- **Differentiator:** Document 10 psychological design commitments (`Identity First`, `Calm Control`, anti-FoMO) rendered visibly in product design.
- **Proof Points:** Sequential `Discover` single-focus card UX, zero popularity rankings (`MATCH-15`), zero streaks/urgency timers, mutual-match chat gate.
- **Main Risk:** *"Anti-swipe dating"* sounds very similar to Hinge/Coffee Meets Bagel's generic mainstream positioning and under-leverages SayMyName's strongest proprietary asset: **the IITM non-campus BS world**.
- **Where It Fits:** Strong **Hero Option C** and **Product UX Rationale in Section 03 (*Inside SayMyName*)**.

### Weighted Strategic Evaluation Scorecard
*(Note: Creative evaluation scores `[1–10]` based on Phase 0 evidence and research synthesis—not measured live A/B conversion data.)*

| Criterion | Weight | Dir 1: *Shared World & Cities* | Dir 2: *Beyond Study Channels* | Dir 3: *Unhurried Anti-Swipe* |
|---|---:|---:|---:|---:|
| Immediate recognition as dating *(requires Hero Eyebrow + Subcopy context)* | `25%` | `8.5` (`2.13`) | `9.0` (`2.25`) | `9.0` (`2.25`) |
| Emotional appeal (*Editorial Romance*) | `20%` | `9.5` (`1.90`) | `7.5` (`1.50`) | `8.0` (`1.60`) |
| Truthfulness & product accuracy (`9e1a58d`) | `20%` | `9.5` (`1.90`) | `9.5` (`1.90`) | `9.0` (`1.80`) |
| Relevance to IITM BS audience | `15%` | `9.5` (`1.43`) | `9.5` (`1.43`) | `6.5` (`0.98`) |
| Differentiation vs Hinge / Bumble / generic apps | `10%` | `9.5` (`0.95`) | `8.5` (`0.85`) | `6.0` (`0.60`) |
| Shareability & peer recall (`WhatsApp`/`Telegram`) | `10%` | `9.5` (`0.95`) | `8.0` (`0.80`) | `7.0` (`0.70`) |
| **Weighted Total (`/ 10.0`)** | **`100%`** | **`9.26` (Recommended)** | **`8.73`** | **`7.93`** |

**Selected Positioning Recommendation (`PROPOSED`):** **Direction 1 (*Shared Geography & Quiet Recognition*)** anchored cleanly by an explicit *"Dating for verified 18+ IIT Madras BS students"* category eyebrow — capturing Direction 1's unmatched emotional resonance, differentiation, and organic shareability while closing its `25%`-weighted category-clarity risk via unmistakable Hero category framing. Elements of Direction 2 (*no awkward study-group DMs*) enrich Section 02, and Direction 3 (*thoughtful prompt-led flow*) shapes Section 03.

---

## 4. The Single Central Promise (`One Idea, Three Reinforcing Pillars`)

> **Central Promise (`PROPOSED`):**  
> *SayMyName gives adult learners across IIT Madras's non-campus BS programmes a genuine, unhurried place to meet peers who share their academic world—starting with mutual interest and protected by quiet privacy boundaries.*

1. **Emotional Promise (Possibility):** There are thoughtful adults studying the same challenging non-campus degree across cities you may never cross paths with on your own—and meeting someone here begins with mutual recognition, not noise.
2. **Experiential Promise (Actual Product):** Inside, you browse real, prompt-driven peer profiles in `Discover`, choose who catches your eye via calm `Likes`, and unlock private `1:1` conversation when interest is truly mutual.
3. **Trust Promise (Confidence Without Fear):** Access is verified once for `18+` adults in the four BS tracks—using institutional inbox confirmation and careful review without collecting government IDs—while a Like never opens unsolicited messages and instant Block/Unmatch puts control in your hands.

---

## 5. Three Hero Copy Directions & 5-Question Hero Test

Full verbatim compositions are provided here and consolidated in `PHASE1_CONTENT_ARCHITECTURE_AND_COPY.md`. *(All copy tagged `PROPOSED — HUMAN APPROVAL REQUIRED`.)*

### Hero Candidate A (`Shared Geography & Quiet Recognition` — Anchor Exploration)
1. **Eyebrow:** `Dating · 18+ IIT Madras BS Community`
2. **Headline:** **Same world. Different cities. A chance to meet.**
3. **Supporting Paragraph:** `An intentional dating space for verified adults (18+) across IIT Madras's four non-campus BS programmes. Explore thoughtful profiles, match mutually, and start quiet conversations beyond study groups—wherever your term takes you.`
4. **Primary CTA:** `Create Account` (`/onboarding`)
5. **Secondary CTA:** `See how it works` (`#how-it-works`) *(Header retains dedicated `Sign In` -> `/login`)*
6. **Eligibility Note:** `For currently enrolled 18+ students in BS Data Science, Electronic Systems, Aeronautics & Space Tech, or Management & Data Science. Independent platform; not affiliated with IIT Madras.`
7. **Trust Reassurance:** `Private photos · Manual 18+ & BS check · No unsolicited DMs`
8. **Visual Description:** Editorial dark stage pairing *Concept 1* (*Two Lights Across the Interval* — dual matte ceramic forms separated by warm `Ember` light) alongside an authentic atmospheric human scene photograph.

### Hero Candidate B (`Intentional Peer Dating Beyond Study Channels`)
1. **Eyebrow:** `Independent Dating · Verified 18+ BS Cohort`
2. **Headline:** **Built for real connection across your BS world.**
3. **Supporting Paragraph:** `Your degree already spans quizzes, late-night projects, and cities across India. SayMyName creates a dedicated dating space for verified adult learners (18+)—where interest stays private until it is mutual, never mixed into public study groups.`
4. **Primary CTA:** `Create Account` (`/onboarding`)
5. **Secondary CTA:** `See how it works` (`#how-it-works`)
6. **Eligibility Note:** `Open to adults 18+ enrolled in the four approved IIT Madras non-campus BS programmes. Independent and unaffiliated with IIT Madras.`
7. **Trust Reassurance:** `Email & manual enrolment review · No government ID needed · Coarse city only`
8. **Visual Description:** Atmospheric candid editorial scene of an evening study table / warm lamp beside an interactive-feeling Discover card edge vignette.

### Hero Candidate C (`Quiet Maturity & Anti-Swipe Depth`)
1. **Eyebrow:** `Dating Across Distance · 18+ IITM Non-Campus BS`
2. **Headline:** **A calmer place to meet someone who shares your pace.**
3. **Supporting Paragraph:** `Swipe apps treat everyone like a crowd. SayMyName brings verified adult students (18+) from IIT Madras's four non-campus BS programmes into one composed dating community—built around real prompts, coarse cities, and conversation that opens only on mutual match.`
4. **Primary CTA:** `Create Account` (`/onboarding`)
5. **Secondary CTA:** `Explore Discover preview` (`#inside-saymyname`)
6. **Eligibility Note:** `Phase 1 covers adults 18+ in Data Science, Electronic Systems, Aeronautics & Space, and Management & Data Science BS tracks. Independent platform.`
7. **Trust Reassurance:** `Zero stranger DMs · Verified human review · Leave or unmatch anytime`
8. **Visual Description:** Tight editorial typography on `Void #0B0D10` paired with *Concept 2* (*Folded Letter & Threshold Key*) and warm subtle human portrait silhouette.

### Five-Question Hero Stress Test

| Evaluation Question | Candidate A (`Same world...`) | Candidate B (`Built for real connection...`) | Candidate C (`Calmer place... shares your pace`) |
|---|---|---|---|
| **1. Immediately identifiable as dating?** | **Yes** — via `"Dating · 18+..."` eyebrow + `"An intentional dating space..."` line 1 *(headline alone is poetic, so eyebrow + line 1 do essential lifting)* | **Yes** — explicit in eyebrow and subcopy (`"dedicated dating space"`) | **Yes** — contrasts `"Swipe apps"` with `"composed dating community"` |
| **2. Communicates relevance to IITM BS?** | **Yes** — explicit in eyebrow, subcopy (`"different cities / wherever your term takes you"`), and eligibility line | **Yes (Strongest)** — `"your BS world"` inside headline + `"quizzes / study groups"` | **Moderate** — subcopy carries BS specificity; `"shares your pace"` could fit general apps |
| **3. Makes the visitor curious?** | **Highest** — `"Same world. Different cities. A chance to meet."` creates instant human story & geographical wonder | **Moderate** — rational/problem-solving appeal | **Moderate** — familiar anti-swipe promise |
| **4. Supporting copy explains actual product?** | **Yes** — `"Explore thoughtful profiles, match mutually, and start quiet conversations"` (100% live Phase 3 truth) | **Yes** — `"interest stays private until it is mutual"` | **Yes** — `"real prompts, coarse cities, and conversation that opens only on mutual match"` |
| **5. Appropriate, non-pressured reason to click?** | **Yes** — open curiosity + safe onboarding | **Yes** — practical safety/separation | **Yes** — tired-of-swiping relief |

> **Recommended Hero Winner (`PROPOSED`):** **Candidate A** (*"Same world. Different cities. A chance to meet."* paired with explicit `"Dating · 18+ IIT Madras BS Community"` eyebrow and clear product subcopy). Keep **Candidate B** (`"Built for real connection across your BS world"`) as primary comprehension-test alternative if 5-second student testing reveals any confusion with Candidate A on small mobile viewports.

---

## 6. Messaging Principles, Lexicon & Guardrails

### Editorial Messaging Principles
1. **Lead With Desire & Recognition, Not Compliance:** Show *why* peers connect before detailing OTP, age checks, and moderation boundaries.
2. **Respect Intelligence Without Sounding Academic:** Write for adult BS students who hate corporate jargon (`"synergy"`) and juvenile meme spam (`"rizz"`). Sound composed, human, clear, and warm.
3. **Reframe Safety as Dignified Boundaries:** Describe consent mechanisms in active human terms (*"A Like is simply interest; private chat opens only when you both agree"*) instead of defensive security jargon (*"Default-deny access control gate"*).
4. **Never Overpromise Live Product Scope:** Every claim on `/` must map cleanly to verified integrated features at baseline `9e1a58d`.
5. **Respect Agency & Single Dignity:** Dating is an invitation, never an obligation; never imply someone is lonely or missing out.

### Language Lexicon (`Use` vs `Avoid`)

| Language to Use (`PROPOSED`) | Language to Strictly Avoid |
|---|---|
| `Dating space`, `meet peers`, `mutual match`, `private conversation`, `thoughtful profiles`, `across cities` | `Default-deny`, `access control`, `verification boundary`, `architecture v1.0`, `enrolment gate`, `ACL`, `coercive design` |
| `Verified 18+ adults`, `carefully reviewed`, `protected community` | `Instant approval`, `AI matching score`, `government ID verification`, `official IITM partner`, `campus portal` |
| `Explore profiles in Discover`, `start a conversation when it's mutual` | `Real-time live calls`, `play mini-games`, `Relationship Mode dashboard`, `download on iOS/Android` *(deferred/unmerged)* |
| `Know someone eligible?`, `Share SayMyName` | `Don't miss out`, `spots filling fast`, `10,000 students inside`, `unlock perks by inviting friends` |

---

## 7. Open Questions Requiring Empirical / Human Confirmation

1. In live `5-second` interviews (`n >= 10` BS students), does Candidate A's `"Same world. Different cities..."` trigger *"dating"* fast enough even for skimmers who barely read the `12–13px` eyebrow?
2. Should the trust reassurance strip below Hero CTAs explicitly mention `"No government ID needed"` (reduces privacy dread for `Segment D`), or save that detail for Section 04 (*How Joining Works*) to keep Hero ultra-clean?
3. Would older working-professional learners (`Segment C`, ages `23–35+`) prefer `"Verified adults (18+)"` or explicit confirmation in Section 02/05 that learners span Foundation, Diploma, Degree, and working-career stages?
