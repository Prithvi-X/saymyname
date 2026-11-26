# Phase 1 Content Architecture & Complete Page Copy — SayMyName.in

**Project:** SayMyName.in — The First Impression Project  
**Phase:** 1 of 6 (Positioning, Messaging, Content Architecture & Wireframing)  
**Baseline:** `landing-page-repositioning` @ `9e1a58d`  
**Status Rule:** **ALL COPY IN THIS DOCUMENT IS `PROPOSED — PENDING HUMAN APPROVAL`.** Zero copy has been applied to `apps/web/app/page.tsx`.  
**Capability Reconciliation Rule:** Only capabilities integrated and usable at verified baseline `9e1a58d` (`registration + OTP`, `manual 18+/BS review`, `guided profile + private R2 portraits`, `Discover`, `Likes`, `Matches`, `Unmatch/Block/Report`, asynchronous `1:1 text Chats`) are presented as live user capabilities. Deferred/unmerged features (`WebSocket push`, `voice notes`, `LiveKit audio calls`, `mini-games`, `virtual dates`, `Relationship Mode UI`, `mobile apps`) are omitted from live claims.

---

## 1. Narrative Arc Overview (`7` Bands)

The page moves the visitor through a continuous, calm emotional progression:

`Recognition (Hero)` → `Possibility (Across Cities & Screens)` → `Understanding (Inside SayMyName)` → `Confidence (How Joining Works)` → `Belonging (The Shared Community)` → `Trust & Control` → `Invitation & Action (Final CTA + Peer Share)`

*Rationale over Phase 0 draft order:* Splitting Phase 0 Band 5 (*"BS Cohorts + Privacy Dignity"*) into **Section 05: The Shared Community** and **Section 06: Trust and Personal Control** prevents crowding the four degree families alongside security promises, giving Section 05 clean typographic poise and Section 06 its own breathing room right before the Closing Invitation.

---

## 2. Complete Proposed Copy & Section-by-Section Architecture

---

### SECTION 01: HEADER AND HERO

#### Header Navigation (`PROPOSED`)
- **Brand Mark:** `SayMyName` Interval Symbol + Grotesk Wordmark (`/`).
- **Navigation Links (Desktop center-left):** `How It Works` (`#how-it-works`) · `Eligibility` (`/eligibility`) · `Safety` (`/safety`)
- **Action Controls (Desktop right):** `Sign In` (`/login`) · **`Create Account`** (`/onboarding`, primary Iris button)
- **Header Mobile Drawer:** Same 5 links stacked cleanly (`min-h-[44px]` touch targets); no hamburger clutter.

---

#### Hero Variant Comparison (`PROPOSED — Choose Final Winner in Decision 1`)

##### **Candidate A — Recommended Default (`Shared Geography & Quiet Recognition`)**
- **Eyebrow:** `Dating for verified 18+ IIT Madras BS students`
- **Headline (`H1`):** `Same world. Different cities. A chance to meet.`
- **Supporting Copy:** `An intentional dating space for verified adults (18+) currently enrolled in IIT Madras’s four non-campus BS programmes. Discover peers beyond study channels, match on mutual interest, and start thoughtful conversations.`
- **Primary CTA:** `Create Account` → `/onboarding`
- **Secondary CTA:** `See how it works ↓` → `#how-it-works`
- **Eligibility & Independence Micro-Note:** `Independent platform—not owned, operated, or endorsed by IIT Madras. Open to adults 18+ in Data Science, Electronic Systems, Aeronautics & Space Tech, or Management & Data Science.`
- **Trust Reassurance Line:** `Confirmed BS inbox · Manual 18+ review · Private photos · No stranger DMs`

##### **Candidate B — Alternative (`Intentional Dating Beyond Study Channels`)**
- **Eyebrow:** `Independent dating · 18+ IIT Madras BS cohort`
- **Headline (`H1`):** `Built for real connection across your BS world.`
- **Supporting Copy:** `Your degree brings people together through quizzes, projects, and shared ambition across cities—without giving you a natural way to date. Meet verified adult peers (18+) privately, where interest stays quiet unless it is mutual.`
- **Primary CTA:** `Create Account` → `/onboarding`
- **Secondary CTA:** `See how it works ↓` → `#how-it-works`
- **Eligibility & Independence Micro-Note:** `Strictly for verified adults (18+) enrolled in the four approved IIT Madras non-campus BS tracks. Independent of IIT Madras.`
- **Trust Reassurance Line:** `No government ID required · Manual enrolment check · Mutual match before messaging`

##### **Candidate C — Alternative (`Unhurried Depth / Anti-Swipe`)**
- **Eyebrow:** `Dating across distance · Verified IITM BS adults (18+)`
- **Headline (`H1`):** `A calmer place to meet someone who shares your pace.`
- **Supporting Copy:** `Built for verified adult learners (18+) across IIT Madras’s four non-campus BS programmes—away from endless swipe loops and chaotic group chats. Read honest prompts, connect city to city, and message only after mutual interest.`
- **Primary CTA:** `Create Account` → `/onboarding`
- **Secondary CTA:** `See the product ↓` → `#inside-saymyname`
- **Eligibility & Independence Micro-Note:** `Independent dating community for the four non-campus BS tracks (18+ only); not affiliated with IIT Madras.`
- **Trust Reassurance Line:** `Verified peers · Coarse city only · Unmatch or block anytime`

---

#### Section 01 Architectural Specification (`Candidate A Selected Baseline`)
- **Visitor’s Question:** *"What is this site, is it actually for dating, and is it worth my time?"*
- **Purpose:** Establish category (`dating`), community (`18+ IITM non-campus BS`), emotional intrigue (`same world, different cities`), and a clean primary path forward inside the very first viewport.
- **Visual Treatment:** Document 10 *Mineral Night* stage (`Void #0B0D10`) with calibrated warm `Ember` subtle ambient key gradient (`<=2%`). **Left (`7 cols` desktop):** Eyebrow, large Display Hero H1 (`64–72px` desktop / `42–44px` mobile), concise subcopy (`max-w-[52ch]`), single primary CTA + quiet secondary text anchor, calm 1-line eligibility & trust note. **Right (`5 cols` desktop):** Paired composition featuring **Concept 1 (*Two Lights Across the Interval* static `AVIF` sculptural centerpiece)** layered cleanly with an atmospheric human editorial frame (`IMG-01`). **Zero wireframe circuit cards or `v1.0` schematics.**
- **Transition to Next Section:** Clean `1px Edge (#343D48)` hairline or soft vertical rhythm leading from Hero's broad aspiration (`"A chance to meet"`) directly into *why* distance makes that rare today.
- **Desktop Composition (`1440px` / `1280px`):** `12-column` asymmetrical split (`7` left text / `5` right Hero art), min-height fitting comfortably above `720px` fold without truncating Headline, Primary CTA, or focal artwork.
- **Mobile Composition (`430px` / `390px` / `375px`):** Stacked compact composition: cropped `16:10` or `4:3` sculptural+editorial visual badge/panel placed **inside the top fold OR cleanly proportioned (`~200–220px` height)** directly above/below compact `42px` H1 + crisp 2-line subcopy + full-width `Create Account` CTA (`48px` height), preventing CTA bloat or off-screen disappearance on `375×667`.
- **Required Assets:** `IMG-01` (Hero atmospheric editorial photography) + `3D-01` (*Two Lights Across the Interval* static `AVIF`/`WebP` render).
- **Claims Requiring Verification:** `Create Account` routes cleanly to `/onboarding` (`verified`); editorial subcopy reflects `9e1a58d` live capabilities (`verified`).

---

### SECTION 02: ACROSS CITIES AND SCREENS

- **Section Number & Name:** `02 · Across Cities and Screens`
- **Visitor’s Question:** *"Why do IIT Madras BS students need a dedicated dating platform?"*
- **Purpose:** Articulate the lived emotional truth of a non-campus degree with warmth and human recognition—without depicting students as lonely or promising guaranteed love.
- **Optional Eyebrow (`12px`):** `Why we built this`
- **Headline (`H2`):** `You share the same term. Just rarely the same city.` (`PROPOSED`)
- **Supporting Copy (`PROPOSED`):**
  > Studying for an IIT Madras non-campus BS degree means balancing deadlines, OPPE sessions, and career goals from bedroom desks, cafés, and hometown libraries across India. You share the same coursework and late nights as thousands of driven adults—yet outside exam halls and brief campus events, there is rarely an ordinary, respectful way to ask someone out.  
  >  
  > SayMyName gives that shared context a private, intentional space of its own: calm enough to read someone’s story properly, and clear enough that study groups never have to turn into awkward DM requests.
- **Visual Treatment:** Asymmetrical `12-column` editorial band on `Coal #12161B` surface: narrow portrait/editorial lifestyle photo on left/right (`IMG-02`, candid evening café/notebook or quiet transit/city dusk scene with warm key light) + clean typographic column (`max-w-[54ch]`), accented by a single vertical `2px Ember #E18A62` editorial quote rule (*Note: avoid decorative border bars across cards per Doc 10; keep as clean typographic pull-offset or pure spacious grid margin*). Better strictly per Document 10 rule ("no decorative left edge bars"): **pure spatial typography + photography grid with `0` edge-bar ornaments**.
- **CTA:** None needed here (narrative bridge into showing the app itself).
- **Transition to Next Section:** Leads directly from *"quiet, honest discovery"* into showing what a real profile and match actually look like.
- **Desktop Composition:** `5 cols` photographic story frame (`0px` image radius per Doc 10) + `7 cols` editorial narrative with subtle 3-point rhythm (*"Across cities"* / *"Beyond course groups"* / *"Adult pacing"* rendered as quiet inline sub-lines, not boxed icons).
- **Mobile Composition:** `4 cols` single vertical column: crisp headline -> 2 concise paragraphs -> `16:10` cropped lifestyle photograph.
- **Required Assets:** `IMG-02` (candid adult urban evening/study setting, authentic model photography).
- **Claims Requiring Verification:** No claim of guaranteed compatibility or successful long-distance outcomes (`verified`).

---

### SECTION 03: THE ACTUAL DATING EXPERIENCE (`#inside-saymyname`)

- **Section Number & Name:** `03 · Inside SayMyName (Product Preview)`
- **Visitor’s Question:** *"What will I actually see and do once I verify my account?"*
- **Purpose:** Show real UI credibility (`Discover`, expressing `Like` / `Pass`, mutual `Match`, opening a `1:1` text `Chat`) using **clearly labelled illustrative sample previews** that honor exact `9e1a58d` design and live features.
- **Optional Eyebrow (`12px`):** `Inside the platform`
- **Headline (`H2`):** `Profiles worth reading. Conversations that start only when both agree.` (`PROPOSED`)
- **Supporting Copy (`PROPOSED`):**
  > No endless swipe decks, compatibility scores, or random chat roulette. Browse fellow verified BS adults one full profile at a time—see their city, degree track, and prompt answers—express quiet interest, and open private messaging once the match is mutual.

#### Three Product Preview Frames *(ALL explicitly labelled `Sample product preview · Illustrative layout`)*
1. **Preview Frame 1 — `Discover` Profile Card (`discover/page.tsx` parity):**
   - **Label badge:** `Sample Preview · Discover`
   - **Portrait Frame:** Commissioned model illustration / editorial non-member portrait (`IMG-03`, labelled sample data—never framed as an active real student).
   - **Card Header & Badges:** `Sample · Verified` (`Verified` badge, `BS in Data Science and Applications` programme tag) -> `Ananya, 22` *(explicitly identified as illustrative sample profile)*.
   - **Context Chips:** `Diploma Level` · `Pune, Maharashtra` · `Looking for: Intentional relationship`
   - **Prompt Card (`Iris` prompt heading):** *"A quiet Sunday outside coursework usually looks like..."* -> *"Filter coffee, a long walk past Fergusson Road, and pretending I’m not behind on Statistics lectures."*
   - **Action Dock:** Clean architectural `Pass` and `Send Like` buttons matching `Button.tsx`.
2. **Preview Frame 2 — `Mutual Match` Moment (`THE INTERVAL` Signature + `discover/page.tsx:1126` parity):**
   - **Label badge:** `Sample Preview · Mutual Match`
   - **Visual:** Minimal two-mass Interval alignment graphic (`Concept 1` motif) resolving cleanly.
   - **Exact Product Copy Mirror:** `It is a mutual match` — *"You both expressed interest independently. Private conversation is now open."* + two quiet buttons: `Keep Discovering` · `Open Conversation`.
3. **Preview Frame 3 — `1:1 Text Chat` Thread (`chats/page.tsx` parity — Async Honest Scope):**
   - **Label badge:** `Sample Preview · Private Chats`
   - **Thread Snippet (Synthetic Sample):**
     - Header: `Ananya · BS-DSA · Pune` | Top safety controls: `Unmatch` / `Safety` clearly visible.
     - Message 1 *(Ananya)*: `"Saw your prompt about switching from mechanical engineering—how are you finding the Diploma project term?"`
     - Message 2 *(Reply)*: `"Honestly surviving on late-evening chai. Would love to trade notes properly—also glad I spotted someone else from the Pune exam centre!"`
   - **Caption Note:** `One-to-one text conversations open strictly between mutual matches, with instant Unmatch, Block, and Report always one tap away.`

- **Visual Treatment:** Tabbed/staged desktop showcase (`7 cols` active preview card + `5 cols` `1–2–3` clickable or sequential feature progression tabs: `01 Discover` / `02 Mutual Match` / `03 Private Chat`), zero dark-pattern notifications or fake unread badges. *(Static fallback shows all 3 cleanly stacked on no-JS or narrow viewports!)*
- **CTA:** Quiet inline anchor `Explore how joining works ↓` (`#how-it-works`).
- **Transition to Next Section:** Having seen the inside experience, visitors naturally ask *"Okay, I want to look inside—what does sign-up and verification require?"*
- **Desktop Composition:** `12-column` split showcase: Interactive 3-step selector rail on left (`4–5 cols`) + high-clarity Coal/Iron sample device stage on right (`7–8 cols`). Explicit top-right disclaimer tag: `Illustrative product preview — zero real user profiles shown`.
- **Mobile Composition:** Swipe/tabbed clean selector tabs (`Discover`, `Match`, `Chat`) above a single responsive card frame (`100%` width, `<= 358px` inner card cleanly readable, no horizontal overflow).
- **Required Assets:** `IMG-03` (clearly labelled campaign/sample model portrait cleanly cropped in `4:4.2` frame, zero fake "IITM student claim").
- **Claims Requiring Verification:** **Zero** mention of WebSockets/instant typing, voice notes, audio calling, mini-games, virtual dates, or Relationship Space UI (all deferred/unmerged at `9e1a58d`).

---

### SECTION 04: HOW JOINING WORKS (`#how-it-works`)

- **Section Number & Name:** `04 · How Joining Works`
- **Visitor’s Question:** *"What actually happens after I click Create Account? Do I need a government ID, and will I get in immediately?"*
- **Purpose:** Demystify the 5-stage `/onboarding` sequence honestly—especially preparing visitors cleanly for the **manual 18+ and BS enrolment review gate** without intimidating bureaucracy.
- **Optional Eyebrow (`12px`):** `Transparent onboarding`
- **Headline (`H2`):** `Verified once, calmly—before Discover opens.` (`PROPOSED`)
- **Supporting Copy (`PROPOSED`):**
  > Every profile you see inside belongs to an adult student who passed the same thoughtful check. An institutional email starts your account, and a human reviewer confirms eligibility before matching unlocks.

#### Verified 5-Step Flow Copy (`1:1 parity with onboarding/page.tsx & ADR-017/020`)
1. **`Step 01` — Create account & confirm BS inbox**  
   Register with your `@study.iitm.ac.in`, `@ds.study.iitm.ac.in`, or `@es.study.iitm.ac.in` address and confirm the 6-digit verification email code.
2. **`Step 02` — Confirm 18+ adult eligibility**  
   Enter your date of birth to establish adult eligibility. Exact birthdates stay off public profiles (`only age—or optional privacy preferences—ever appear inside`). *(Wait—verify actual `ageDisplayMode` in profile schema! Notice user JSON earlier had `"ageDisplayMode": "show_calculated_age"`. Say simply: `"Exact birthdates are never published on your Discover card."` — `100%` accurate!)*
3. **`Step 03` — Select BS track & optional enrolment note**  
   Choose your non-campus BS programme and stage (`Foundation`, `Diploma`, or `Degree`). You may include a non-government enrolment check such as an enrolment letter, portal screenshot, or term fee receipt—**government IDs are never requested**.
4. **`Step 04` — Build your draft while review runs**  
   Every age and enrolment case goes through a confidential human review (`domain strings alone never grant automatic access`). You can prepare your bio, city, interests, and prompts comfortably while your review completes.
5. **`Step 05` — Add a portrait & enter Discover**  
   Once approved, upload at least one genuine portrait into private storage and publish your card into Discover.

- **Important Expectation Callout (Calm Inline Line, Not Warning Box):**  
  `Note: Because every age and enrolment check is manually verified to protect community trust, verification is not instantaneous. We never ask for Aadhaar, PAN, or passports.`
- **CTA:** Quiet text link: `Read full eligibility criteria →` (`/eligibility`)
- **Transition to Next Section:** Leads smoothly from *"your BS track check"* to showing all four BS tracks together as one unified peer community.
- **Desktop Composition:** Horizontal 5-step architectural timeline rail (`Coal` base, subtle stepped connectors, crisp `13px–15px` copy—NOT heavy separate compliance walls).
- **Mobile Composition:** Clean vertical numbered stepper list (`left numbered column + concise text`, zero sprawling multi-border nested boxes).
- **Required Assets:** None heavy (typographic numbered badges `01..05`).
- **Claims Requiring Verification:** Accurate match to `/onboarding` views `register` -> `otp` -> `age` -> `student` -> `review` (`VERIFICATION_PENDING`) -> `profile` (`publish` requires `>= 1` portrait in R2). No approval SLA countdown claimed (`verified`).

---

### SECTION 05: THE SHARED COMMUNITY

- **Section Number & Name:** `05 · The Shared Community`
- **Visitor’s Question:** *"Are all non-campus BS branches here, or just Data Science?"*
- **Purpose:** Celebrate the **four approved IIT Madras non-campus BS programme families** as peers sharing one roof—using compact editorial typography rather than four heavy corporate specification cards.
- **Optional Eyebrow (`12px`):** `Phase 1 community scope`
- **Headline (`H2`):** `Four non-campus BS tracks. One shared community.` (`PROPOSED`)
- **Supporting Copy (`PROPOSED`):**
  > Whether you are building statistical models, designing circuits, exploring propulsion, or bridging management and data—SayMyName brings adult learners (18+) across all four IIT Madras non-campus BS pathways together across Foundation, Diploma, and Degree stages.
- **Compact Typographic / Editorial Programme Index *(Official Exact Names Preserved)*:**
  - `BS · DSA` — **BS in Data Science and Applications** *(Foundation · Diploma · Degree)*
  - `BS · ES` — **BS in Electronic Systems** *(Foundation · Diploma · Degree)*
  - `BS · AST` — **BS in Aeronautics and Space Technology** *(Foundation · Diploma · Degree)*
  - `BS · MDS` — **BS in Management and Data Science** *(Foundation · Diploma · Degree)*
- **Concise Scope Clarification Line (`13px Ash`):**  
  `Phase 1 is exclusively for verified 18+ adults currently enrolled in these four non-campus BS programmes. On-campus degrees, alumni, and outside universities are not included.`
- **Visual Treatment:** Compact `2-column` asymmetrical editorial ledger on `Void #0B0D10` (`4 cols` headline/summary + `8 cols` tight ruled typographic list with subtle `Edge` horizontal dividers — retiring the old tall boxy `2×2` curriculum cards). Optional subtle geometric accent echoing the 4 aligned Interval lines.
- **CTA:** None primary; `/eligibility` link lives cleanly in Section 04 or compact inline text.
- **Transition to Next Section:** Moves from *"who is inside"* to *"how everyone inside is protected."*
- **Mobile Composition:** Single vertical column with crisp hairline-separated rows (`min-height ~52px` per row)—fast to scan in 3 seconds.
- **Claims Requiring Verification:** Exact four programme names match `packages/validation/src/eligibility.ts` and `eligibility/page.tsx` (`verified`).

---

### SECTION 06: TRUST AND PERSONAL CONTROL

- **Section Number & Name:** `06 · Trust and Personal Control`
- **Visitor’s Question:** *"Will random peers see my real name/email, spam me, or track my location?"*
- **Purpose:** Reassure privacy-conscious learners (`Segment D`, `Segment C`) through clear member-first care rather than clinical legal jargon, referencing `/safety` for technical details.
- **Optional Eyebrow (`12px`):** `Built around calm boundaries`
- **Headline (`H2`):** `Respect is designed into how people connect.` (`PROPOSED`)
- **Three Concise Promises *(100% Backend-Truthful at `9e1a58d`)*:**
  1. **A verified 18+ peer community**  
     Everyone inside passes email confirmation plus manual 18+ age and BS enrolment review before seeing Discover. Institutional email prefixes, birthdates, and roll numbers never appear on public profiles.
  2. **Private conversation only on mutual interest**  
     Sending a Like is never permission to message. Direct text chat opens strictly when both verified adults independently express mutual interest—no unsolicited stranger DMs or public social feeds.
  3. **Your privacy & safety, always in your hands**  
     Profiles display coarse city and state only—never live GPS. Portraits live in private storage accessed through short-lived authorised links and are never used for advertising or external AI training. Unmatch, Block, or Report works immediately on the server whenever you choose.
- **Safety Deep-Dive Link:** `Read full Safety & Consent Architecture →` (`/safety`)
- **Honesty Check (Explicit Non-Claims Verified):** Zero claim of E2EE, zero promise preventing another user from taking an external phone screenshot/camera photo, zero claim of unbuilt live call recording/games protections on `/`.
- **Desktop Composition:** `12-column` balanced `3-column` horizontal architectural grid on `Coal #12161B` with generous spacing, subtle `12px–16px` padding, `14–15px` Silver body text (`>=10:1` contrast).
- **Mobile Composition:** `3` clean stacked cards with clear bold titles and calm breathing space (`16px` gaps).
- **Required Assets:** Minimal semantic line icons (`ShieldIcon`, `LockIcon`, `UserIcon` already in `icons.tsx` — zero decorative illustration clutter).

---

### SECTION 07: INVITATION, NATURAL SHARING & FINAL CTA

- **Section Number & Name:** `07 · Invitation & Closing Action`
- **Visitor’s Question:** *"Am I ready to join—and how can I tell an eligible BS friend about this?"*
- **Purpose:** Bring the story full circle to the romantic possibility (*"There are people you haven't met yet"*), deliver a clean single primary `Create Account` button above the footer, and offer a low-friction peer-share gesture without fake incentives.

#### Part A: Closing Emotional Invitation (`PROPOSED`)
- **Eyebrow (`12px`):** `Begin when you are ready`
- **Headline (`H2`):** `There are people in your world you haven’t met yet.` *(Alternatives below)*
  - *Alternative 1:* `Someone worth knowing might be a city away.`
  - *Alternative 2:* `Real conversations start when the setting feels right.`
- **Supporting Copy (`PROPOSED`):** `Join SayMyName with your IIT Madras BS study email, move at your own pace, and discover peers across cities who are here for something genuine.`
- **Single Primary CTA:** `Create Account` → `/onboarding` *(Zero competing secondary buttons next to it!)*

#### Part B: Natural Peer-Sharing Band (`PROPOSED`)
- **Card Heading:** `Know someone eligible who might appreciate something calmer?`
- **Supporting Copy:** `SayMyName grows through real classmates—not loud ads. If a friend in the IITM BS programme is single and tired of noisy dating apps, send them the link quietly.`
- **Share Control:** `Share SayMyName` (triggers `navigator.share` on supported mobile/desktop browsers with clipboard copy fallback to `https://saymyname.in/?src=peer` + quiet status feedback `"Link copied"`).
- **Reassurance Micro-Copy:** `No referral points, contact syncing, or invite requirements—just a quiet introduction between peers.`

- **Desktop Composition:** `12-column` asymmetrical finale (`7 cols` Closing Invitation + `Create Account` button anchored on left; `5 cols` subtly framed `Iron` Peer-Share module on right).
- **Mobile Composition:** Closing Invitation (`Create Account` full-width `48px` button) stacked cleanly above compact `Copy / Share link` block (`gap-8`), followed cleanly by `PublicFooter.tsx`.

---

### FOOTER (`PublicFooter.tsx` Continuity — `PROPOSED` Copy Tuning Only)
Keep existing 4-column architecture cleanly aligned:
- **Brand Col:** `SayMyName` lockup + *"An independent dating-first space for verified adults (18+) enrolled in approved IIT Madras non-campus BS programmes. Not owned, operated, or endorsed by IIT Madras."*
- **Platform:** `Overview` (`/`), `How It Works` (`/#how-it-works`), `Eligibility Guide` (`/eligibility`), `Safety & Consent` (`/safety`)
- **Access:** `Member Sign In` (`/login`), `Create Account` (`/onboarding`), `Password Recovery` (`/forgot-password`)
- **Governance:** `Privacy Notice` (`/privacy`), `Terms of Use` (`/terms`), `Member Support` (`/support`) + existing truthful support-mailbox disclosure (`getConfiguredSupportEmail()`).

---

## 3. Mobile-Specific Copy & Readability Adjustments (`375px–430px`)

1. **Zero 11px Micro-Labels:** Elevate all homepage eyebrow and tag metadata from `11px` to `12px–13px` (`Document 10 §09` compliance) for effortless reading on affordable mobile panels.
2. **Hero Word Tightness (`<= 38` words visible before Primary CTA on `375px`):** Keep Eyebrow `1` short line (`Dating · 18+ IIT Madras BS Cohort` -> fits `1` line cleanly at `375px` instead of wrapping to `2`!), H1 at `42px / 1.04` (`~3` crisp lines), and concise `2-sentence` subcopy (`~28` words) so **Headline + Subcopy + Primary CTA + focal visual anchor fit comfortably above/at fold**.
3. **Interactive Section 03 Tabs on Mobile:** Switch vertical stacking of 3 giant previews into **1 compact tab bar (`Discover` | `Match` | `Chat`)** displaying 1 detailed card at a time, cutting vertical mobile page height from `4448–4613 px` (`5.3–6.9×`) down to an estimated **`~2700–3100 px`** cleanly!

---

## 4. Word-Count & Cognitive Load Budget

| Metric | Phase 0 Baseline (`/`) | Phase 1 Proposed Blueprint | Change |
|---|---:|---:|---|
| Visible rendered copy | `~555` policy-dense words | `~420–460` conversational editorial words (spread across `7` story bands instead of dense blocks) | Warmer, scannable rhythm |
| Photographic / visual assets | `0` images + `1` wireframe schematic | `3` curated editorial photos (`IMG-01..03`) + `1` sculptural `AVIF` (`3D-01`) + sample UI screens | Real human presence |
| Primary vs secondary hero links | `3` inline hero CTAs + `2` nav buttons | `1` Primary CTA (`Create Account`) + `1` quiet scroll link (`See how it works ↓`) | Unambiguous funnel focus |
| Technical jargon instances (`Default-deny`, `v1.0`, `Boundary`) | `8+` visible instances | `0` on homepage `/` *(detailed specifications live properly on `/eligibility` & `/safety`)* | Repositioning achieved |
