# Phase 0 Audience, Psychology & Academic Research — SayMyName.in

**Workstream:** The First Impression Project — Landing Page Repositioning & Conversion Redesign  
**Phase:** 0 of 6 (Research, Audit & Discovery)  
**Epistemic Boundary:** Every audience segment, pain point, and conversion lever below explicitly separates **Verified Product Rules**, **Verified Academic Literature**, and **Unvalidated Audience Hypotheses** requiring real-student validation before irreversible copy/UI lock-in.

---

## 1. Structural Context of the Target Audience

*[Verified Product Facts — Documents 01–02 & `packages/validation/src/eligibility.ts`]*

SayMyName Phase 1 serves an unusually specific social topology: **verified adults (18+) currently enrolled in one of four approved IIT Madras non-campus BS programmes**:
1. BS in Data Science and Applications (`Foundation`, `Diploma`, `Degree`)
2. BS in Electronic Systems (`Foundation`, `Diploma`, `Degree`)
3. BS in Aeronautics and Space Technology (`Foundation`, `Diploma`, `Degree`)
4. BS in Management and Data Science (`Foundation`, `Diploma`, `Degree`)

Unlike residential campuses—where accidental romantic discovery happens naturally in hostels, mess halls, lectures, and Paradox festivals—**IITM non-campus BS learners are geographically dispersed across Indian and international cities**. Many share exams, OPPEs, project deadlines, study groups, and Discord/WhatsApp channels without ever having a calm, high-trust environment built explicitly for adult romantic connection.

At the same time, SayMyName must **strictly exclude** (`Document 01 §03`, `D-01`, `D-P2-03`):
- Anyone under `18` years old (even if enrolled in Foundation level)
- On-campus IITM degree students (`@iitm.ac.in`, `@smail.iitm.ac.in`)
- Alumni, discontinued learners, qualifier-only applicants, NPTEL/MOOC learners, or students from other institutions
- Any implication that IIT Madras owns, endorses, or runs SayMyName

---

## 2. Audience Segmentation (`Hypotheses — To Be Validated`)

> **Important Epistemic Disclaimer:** SayMyName has **not yet run primary user interviews or quantitative surveys** with IITM BS students. The 5 behavioural segments below are **structured strategic hypotheses** grounded in the programme structure and general emerging-adult relationship literature—they are NOT empirical facts about IITM BS cohorts until tested via the Interview Guide in §3.

### Segment A: Full-Time Standalone Non-Campus BS Learners (`18–23`, Distributed Home-Study)
- **Hypothesized context:** Enrolled solely in IITM BS (often living at home or preparing in tier-1/2/3 cities), experiencing intense online coursework and low daily offline peer socialization outside seasonal in-person exams or Paradox.
- **Hypothesized desires:** Wants real peer romance with people who genuinely relate to term pacing, quizzes, and ambition—without chaotic hookup culture.
- **Hypothesized anxieties:** *"Is anyone from my cohort actually near my city or open to long-distance? Will a dating app expose my student identity to people I know on Discord?"*
- **Landing page implication:** Emphasize shared world across cities, tasteful privacy boundaries (display name, coarse city/state only), and warm profile discovery.

### Segment B: Dual-Degree / Hybrid College Students (`18–24`, Campus Elsewhere + IITM BS)
- **Hypothesized context:** Attending a local BTech/BSc/BBA college offline while pursuing IITM BS as a second degree. Already saturated by mainstream apps (Hinge/Bumble/Tinder) on their local campus.
- **Hypothesized desires:** Seeks a **higher-signal, intellectually compatible cohort** than noisy city-wide swipe pools; appreciates intentional prompts and mutual respect.
- **Hypothesized anxieties:** *"Why bother adding a fifth app with extra verification steps if mainstream apps already work?"*
- **Landing page implication:** Show *why* curated BS peers + anti-spam mutual gates create better first conversations than endless local swiping; minimize onboarding dread by showing reward first.

### Segment C: Working Professionals & Career-Switchers (`23–35+`, Evening/Weekend BS Learners)
- **Hypothesized context:** Mature adult learners balancing full-time engineering/analytics/corporate jobs alongside IITM BS; strongly intolerant of juvenile memes, immature UI, or noisy gamified apps.
- **Hypothesized desires:** Direct, respectful adult dating where verification ensures serious peers, and age diversity/life stage alignment is taken seriously.
- **Hypothesized anxieties:** *"Is this site just for 19-year-old undergrads? Is it an unmaintained student side-project with leaky privacy?"*
- **Landing page implication:** *Editorial Romance* maturity—composed typography, dark cinematic poise, grounded copy (zero slang/emoji-heavy pandering), explicit non-gov-ID privacy assurance.

### Segment D: Privacy-Conscious & Safety-Skeptical Women / Non-Male Learners (`18+`)
- **Hypothesized context:** Often carry the heaviest safety burden on Indian dating platforms (unsolicited DMs, screenshot fear, stalker risk, doxxing, lack of recourse).
- **Hypothesized desires:** Meaningful autonomy—knowing someone **cannot message without a mutual match**, portraits sit in private storage, exact location is hidden, and blocking/unmatching is atomic.
- **Hypothesized anxieties:** *"If I upload photos using my student email, can anyone find my roll number, harass me in Telegram groups, or message me uninvited?"*
- **Landing page implication:** Keep trust assurances **authentic and clear**, but weave them *alongside* human warmth (never let security terminology sound scary or cold, and show concrete control like mutual-match gating and coarse location).

### Segment E: Skeptical Invited Peers (High-Intent Word-of-Mouth Arrivals)
- **Hypothesized context:** Receives a WhatsApp/Telegram link from a verified friend saying *"try this IITM BS dating site"*.
- **Hypothesized desires:** Immediate vibe check within 5–10 seconds: *"Does this look safe, legitimate, stylish, and worth uploading a photo for—or sketchy and broken?"*
- **Hypothesized anxieties:** Social stigma if the site looks awkward, cheap, or overtly "thirsty", OR confusion if it looks like an exam/portal login page.
- **Landing page implication:** Crisp OpenGraph preview card + unmistakable first-impression balance of romance, aesthetic craft, and verified legitimacy.

---

## 3. Primary Research Validation Plan (Qualitative Interview Guide)

To turn Segments A–E from hypotheses into evidence before Phase 2/3 production lock-in, conduct **10–15 semi-structured 25-minute interviews** across diverse tracks (`BS-DSA`, `BS-ES`, `BS-AST`, `BS-MDS`), age brackets (`18–21`, `22–26`, `27+`), genders, and locations (metro vs non-metro).

### Non-Leading Core Questions (8–12 Prompts)
1. **Context:** *Walk me through how you currently meet new people or dates while doing the IITM BS programme from your city.*
2. **Comparison:** *If you have tried any dating apps or student communities before, what made you install them—and what made you pause, mute, or uninstall them?*
3. **5-Second Reaction (Concept Neutral):** *(Show current `/` for 5 seconds, hide screen.) In your own words, what did you think this website is, who runs it, and what happens if you click the main button?*
4. **Emotional Resonance:** *Which words or phrases on that screen pulled you in, and which made you hesitate or feel uneasy?*
5. **Verification Tradeoff:** *How would you feel if creating a profile required confirming your `@study.iitm.ac.in` inbox and waiting for a manual 18+ / BS enrolment review before seeing profiles? At what point would you drop off, if at all?*
6. **Privacy Boundaries:** *What personal details feel comfortable on a verified cohort dating card (e.g., city, BS level, prompts), and what would feel crossing a line?*
7. **Discovery Across Distance:** *Would you browse peers in other cities, or mostly near yours? What makes a long-distance connection feel worth starting online?*
8. **Word-of-Mouth Trigger:** *Think of a close BS friend who is single. What would make you comfortable sending them a link to a site like this—and what would stop you from sharing it?*
9. **Headline & Concept Comparison Test:** *(Show 3 unbranded positioning concepts: Institutional/Compliance vs Editorial Romance vs Playful Student Vibe — randomized order.) Which feels most trustworthy and appealing for someone like you, and why?*
10. **First-Screen Visual Proof:** *Before signing up, what would you need to see on the homepage to feel confident real, respectful people are here?*

---

## 4. Verified Academic Research Grounding

All **8 studies** below were verified during Phase 0 (`title`, authors, journal, year, DOI, sample/methodology, empirical findings, and explicit scope limitations).

| # | Citation & Verified DOI | Study Type, Sample & Methodology | Key Empirical Findings Relevant to SayMyName | Explicit Limitations & Boundary Conditions |
|---|---|---|---|---|
| 1 | **Finkel, E. J., Eastwick, P. W., Karney, B. R., Reis, H. T., & Sprecher, S. (2012).** *Online Dating: A Critical Analysis From the Perspective of Psychological Science.* *Psychological Science in the Public Interest*, 13(1), 3–66. DOI: [`10.1177/1529100612436522`](https://doi.org/10.1177/1529100612436522) | Critical integrative literature review & theoretical synthesis of pre-2012 empirical studies on online dating, speed-dating, and CMC attraction. | Large-scale profile "shopping" grids foster an **assessment/commodity mindset** and cognitive overload, undermining relationship discernment; matching algorithms lack scientific evidence for predicting long-term compatibility; CMC works best when transitioning sensibly to meaningful dyadic interaction. | Pre-mobile-swipe-era body of studies (pre-2012); highlights a gap between brief lab/speed-dating studies and long-term longitudinal outcomes; commercial algorithms unverified. |
| 2 | **Ellison, N. B., Heino, R. D., & Gibbs, J. L. (2006).** *Managing Impressions Online: Self-Presentation Processes in the Online Dating Environment.* *Journal of Computer-Mediated Communication*, 11(2), 415–441. DOI: [`10.1111/j.1083-6101.2006.00020.x`](https://doi.org/10.1111/j.1083-6101.2006.00020.x) | Mixed-method: `N = 34` qualitative in-depth phone interviews (`2004–2005`, active urban & rural daters) + supporting web survey data. | Online daters navigate tension between **self-enhancement and authenticity**, constrained by *"warranting"* expectations of meeting offline ("the foggiest mirror"); small profile cues carry outsized impression weight because visitors scrutinize limited textual/visual signals. | U.S. West-Coast geographic skew and volunteer self-selection; early-2000s desktop profile context (`Connect.com`); self-reported honesty bias. |
| 3 | **Gibbs, J. L., Ellison, N. B., & Heino, R. D. (2006).** *Self-Presentation in Online Personals: The Role of Anticipated Future Interaction, Self-Disclosure, and Perceived Success.* *Communication Research*, 33(2), 152–177. DOI: [`10.1177/0093650205285368`](https://doi.org/10.1177/0093650205285368) | Quantitative cross-sectional online survey (`N = 349` Match.com random sample; `N = 39` survey pretest). | **Anticipated face-to-face / future interaction** significantly predicts more **honest, positive, and intentional self-disclosure**, which in turn correlates with perceived dating success. Closed, real-stake communities encourage better behaviour than anonymous one-off environments. | Cross-sectional single time-point design (no causal proof); Match.com 2000s U.S. subscriber sample; self-report bias on honesty and success scales. |
| 4 | **Sumter, S. R., Vandenbosch, L., & Ligtenberg, L. (2017).** *Love me Tinder: Untangling emerging adults' motivations for using the dating application Tinder.* *Telematics and Informatics*, 34(1), 67–78. DOI: [`10.1016/j.tele.2016.04.009`](https://doi.org/10.1016/j.tele.2016.04.009) | Cross-sectional online survey (`N = 163` Dutch emerging adults aged `18–30` with Tinder experience). | Identified **6 distinct motivations** beyond casual sex: **Love**, **Casual Sex**, **Ease of Communication**, **Self-Worth Validation**, **Thrill of Excitement**, and **Trendiness**. Notably, *Love* motivation was stronger than *Casual Sex* for many emerging adults, and *Ease of Communication* mattered heavily for starting dialogue. | Small single-country emerging-adult sample (`N = 163`); Tinder-specific (pre-pandemic); self-reported cross-sectional motives. |
| 5 | **Toma, C. L., & Hancock, J. T. (2010).** *Looks and Lies: The Role of Physical Attractiveness in Online Dating Self-Presentation and Deception.* *Communication Research*, 37(3), 335–351. DOI: [`10.1177/0093650209356437`](https://doi.org/10.1177/0093650209356437) | Laboratory comparison + self-report measurement (`N = 80` online daters comparing actual lab measurements/photos vs live dating profiles). | Strategic misrepresentation on dating profiles is subtle and widespread when accountability is low, especially around height/weight/outdated photos—fueling visitor **authenticity skepticism** when platforms look overly polished or unverified. | Small U.S. regional sample (`N = 80`), 2010 web-profile context; lab rating may not reflect long-term conversational trust. |
| 6 | **Acquisti, A., Brandimarte, L., & Loewenstein, G. (2015).** *Privacy and Human Behavior in the Age of Information.* *Science*, 347(6221), 509–514. DOI: [`10.1126/science.aaa1465`](https://doi.org/10.1126/science.aaa1465) | Multidisciplinary behavioural-economics and psychology review published in *Science*. | Privacy preferences are **context-dependent and malleable**, shaped by UI framing and trust cues (*"Control Paradox"* & *"Privacy Paradox"*): intimidating legal/surveillance framing raises anxiety, whereas clear **structural defaults** (minimal disclosure by design, non-punitive clarity) foster safer, calmer trust than dense policy prose. | Broad policy/digital-behaviour review rather than a single dating RCT; requires careful translation so reassuring defaults never become deceptive dark patterns. |
| 7 | **Przybylski, A. K., Murayama, K., DeHaan, C. R., & Gladwell, V. (2013).** *Motivational, emotional, and behavioral correlates of fear of missing out.* *Computers in Human Behavior*, 29(4), 1841–1848. DOI: [`10.1016/j.chb.2013.02.014`](https://doi.org/10.1016/j.chb.2013.02.014) | 3-study psychometric validation & behavioural survey (Study 1: `N = 1,013` international; Study 2: `N = 2,079` UK national; Study 3: `N = 87` university undergraduates). | Deficits in **basic psychological needs** (competence, autonomy, **relatedness**) correlate with higher FoMO and compulsive checking—explaining why countdowns, fake scarcity, and swipe loops heighten **romantic anxiety** rather than healthy belonging (directly supporting SayMyName's non-coercive anti-FoMO commitments). | Cross-sectional self-report designs; Study 3 university cohort small (`N = 87`); Western demographic weighting. |
| 8 | **Berger, J., & Milkman, K. L. (2012).** *What Makes Online Content Viral?* *Journal of Marketing Research*, 49(2), 192–205. DOI: [`10.1509/jmr.10.0353`](https://doi.org/10.1509/jmr.10.0353) | Observational field analysis of ~`7,000` *New York Times* articles over 3 months + controlled lab experiments. | Content spreads organically when it carries **positive high-arousal emotion** (awe, warmth, excitement, amusement) or **practical social utility**—rather than dry institutional prose or sadness/defensive anxiety. | *New York Times* high-education readership & email-sharing metric (`2012`); editorial articles differ from private peer dating links, so peer invite triggers still require SayMyName validation. |

*Note also Document 10's already-cited UI ergonomics foundations (retained as internal standards baseline):* **Tuch et al. (2012)** (`10.1016/j.ijhcs.2012.06.003` — visual complexity & prototypicality drive rapid aesthetic judgments), **Andrew, Bishop, & Tigwell (2024)** (`10.1145/3643539` — dark-mode consistency across UI elements), and **Li et al. (2022)** (`10.1080/00140139.2021.2013546` — text brightness contrast matters more than background hue under negative polarity).

---

## 5. Research-to-Design Translation Matrix

| Research Insight | Source(s) | What Current `saymyname.in` Gets Wrong | Concrete Landing-Page & Conversion Recommendation |
|---|---|---|---|
| **Avoid "Shopping Grid / Compliance Portal" First Impressions** | Finkel et al. (2012); Tuch et al. (2012) | Shows a dry 4-card regulatory diagram + `"v1.0"` tech card that neither matches a familiar dating mental model nor invites emotional exploration. | Lead with an unmistakable **Editorial Romance** dating frame: human aspiration, one composed focal scene, and curated single-profile storytelling (`Discover` preview card with prompts & city/track) rather than grid/system diagrams. |
| **Honesty & Intent Rise When Future Peer Interaction Feels Real** | Gibbs et al. (2006); Ellison et al. (2006) | Mentions IITM BS in bureaucratic legalese (`"four non-campus BS cohorts"`) rather than highlighting that you may actually meet peers across study sprints, exams, and cities. | Frame cohort verification as **real-world accountability and shared ground** (*"Same world. Different cities."*), elevating sincerity without threatening privacy. |
| **Ease of Starting Dialogue Drives Emerging-Adult Adoption** | Sumter et al. (2017) | Explains *"Messaging Gate: Active Mutual Match Required"* like an API ACL rule, giving zero glimpse of how natural conversation begins. | Preview a real prompt-led `Discover` -> warm conversation starter sequence (`"What pulled you into this track?"`) showing how easy it is to break the ice after matching. |
| **Offset Authenticity Skepticism Without Threatening Tone** | Toma & Hancock (2010); Acquisti et al. (2015) | Uses aggressive/clinical phrases (`"Default-deny access"`, `"Built against unwanted contact and coercive design"`) that spike privacy vigilance rather than calm reassurance. | Re-sequence: earn interest first, then present **calm, dignified safety guarantees** (18+ verified peers, no unsolicited stranger DMs, coarse city/state only, zero gov-ID hoarding) in reassuring human copy. |
| **Refuse FoMO & Fake Scarcity; Build Calm Belonging** | Przybylski et al. (2013); Doc 10 §05 | Good anti-FoMO intent (`AGENTS.md`), **but** current page offers zero sense of warmth or belonging—just cold dark boxes. | Pair anti-scarcity ethics with genuine warmth (`Ember` accents, natural portraits/hands/scenes, calm pace copy) so "calm" feels inviting, not empty. |
| **Peer Sharing Requires Positive Pride & Social Utility** | Berger & Milkman (2012) | Sharing `saymyname.in` in WhatsApp produces zero OG image and dry text (`"Intentional dating across distance..."`); zero prideful identity cue for an eligible friend. | Build a crisp, share-worthy OG card + low-pressure *"Know someone in the BS cohort?"* share mechanism (web share / copy link) using *positive identity pride*—never manipulative referral spam. |
