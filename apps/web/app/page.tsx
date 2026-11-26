import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { Button } from '../components/ui';

export const metadata: Metadata = {
  title: {
    absolute: 'SayMyName.in — Intentional dating for verified IIT Madras non-campus BS adults',
  },
  description:
    'An independent dating-first community for verified adults (18+) currently enrolled in IIT Madras non-campus BS programmes. Mutual interest before conversation.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'SayMyName.in — Same world. Different cities. A chance to meet.',
    description:
      'An independent dating space for verified adults (18+) in IIT Madras non-campus BS programmes, built around mutual consent and unhurried conversation.',
    url: 'https://saymyname.in',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SayMyName.in — Same world. Different cities. A chance to meet.',
    description:
      'Independent dating space for verified adults (18+) enrolled in IIT Madras non-campus BS programmes.',
  },
};

const PROGRAMME_FAMILIES = [
  {
    code: 'BS · DS',
    title: 'BS in Data Science and Applications',
    pathways: 'Foundation · Diploma · Degree',
    detail: 'Statistics, machine learning, programming, and applied data systems.',
  },
  {
    code: 'BS · ES',
    title: 'BS in Electronic Systems',
    pathways: 'Foundation · Diploma · Degree',
    detail: 'Digital design, embedded hardware, circuits, and signal analysis.',
  },
  {
    code: 'BS · AST',
    title: 'BS in Aeronautics and Space Technology',
    pathways: 'Approved Cohort Track',
    detail: 'Flight mechanics, orbital principles, propulsion, and aerospace engineering.',
  },
  {
    code: 'BS · MDS',
    title: 'BS in Management and Data Science',
    pathways: 'Approved Cohort Track',
    detail: 'Quantitative management, analytics, operations, and decision systems.',
  },
];

const VERIFICATION_GATES = [
  {
    step: '01',
    title: 'Institutional Domain & Password',
    desc: 'Register with an approved IIT Madras non-campus BS study inbox and confirm ownership via expiring one-time code.',
  },
  {
    step: '02',
    title: 'Strict 18+ Adult Eligibility',
    desc: 'SayMyName enforces an 18+ adult boundary independent of IITM programme admission age.',
  },
  {
    step: '03',
    title: 'Enrolment Review Boundary',
    desc: 'Programme family and Foundation, Diploma, or Degree level enter review — domain strings alone never grant verification.',
  },
  {
    step: '04',
    title: 'Guided Draft & Genuine Portrait',
    desc: 'Save profile drafts freely while setting up, then upload at least one portrait into private storage before entering Discover.',
  },
];

const CONSENT_INVARIANTS = [
  {
    label: 'MUTUAL MATCH GATE',
    title: 'A Like is never permission to message',
    body: 'Direct chat opens only after two verified adults express mutual interest. Unilateral outreach, open public directories, and stranger DMs do not exist.',
  },
  {
    label: 'BILATERAL SHARED SPACES',
    title: 'Every call, game, and date requires consent',
    body: 'Voice notes, live audio sessions, cohort mini-games, and scheduled virtual dates require an explicit invitation and explicit partner acceptance.',
  },
  {
    label: 'RELATIONSHIP MODE',
    title: 'Two affirmative actions to pair, one to leave',
    body: 'Activating Relationship Mode pauses active Discover visibility while opening shared milestones and journals. Either partner can exit independently at any time.',
  },
  {
    label: 'LOCATION & MEDIA HYGIENE',
    title: 'City & state only · Short-lived media links',
    body: 'Exact coordinates are never collected. Portrait images remain inside private storage buckets served via short-lived authorised signatures.',
  },
];

export default function HomePage() {
  return (
    <div className="bg-void text-chalk font-ui smn-stage-wrap">
      {/* HERO SECTION: 12-Column Asymmetric Architectural Grid */}
      <section className="relative border-b border-edge smn-ambient-hero overflow-hidden">
        {/* Cropped Architectural Planes (THE INTERVAL offset plane & ambient depth, non-interactive) */}
        <div
          aria-hidden="true"
          className="pointer-events-none hidden md:block absolute -top-24 -right-24 w-[520px] h-[520px] rounded-[16px] smn-hero-plane-a"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none hidden lg:block absolute top-14 right-[10%] w-[380px] h-[380px] rounded-[16px] smn-hero-plane-b smn-ambient-breathe"
        />

        <div className="relative container-wide py-12 sm:py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left 7 Columns: Editorial Proposition & Actions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2.5 self-start px-3 py-1.5 rounded-[4px] bg-coal border border-edge text-[11px] font-semibold uppercase tracking-[0.14em] text-silver">
              <span className="w-1.5 h-1.5 bg-iris" aria-hidden="true" />
              <span>Phase 1 · IIT Madras Non-Campus BS Cohort</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[3.1rem] font-semibold tracking-[-0.03em] leading-[1.08] text-chalk">
              Intentional dating across distance, built around verified peers and mutual consent.
            </h1>

            <p className="text-base sm:text-lg text-silver leading-relaxed max-w-2xl">
              Remote degrees bridge cities and terms, yet rarely leave room for thoughtful
              personal connection. SayMyName connects verified adult learners (18+) in IIT
              Madras&apos;s four non-campus BS programmes—from first mutual match through
              long-distance relationship continuity.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link href="/onboarding">
                <Button variant="primary" size="lg">
                  Create Account
                </Button>
              </Link>
              <Link href="/eligibility">
                <Button variant="secondary" size="lg">
                  Explore Eligibility
                </Button>
              </Link>
              <Link
                href="/login"
                className="px-3 py-2 text-sm font-medium text-silver hover:text-chalk transition-colors"
              >
                Member Sign In →
              </Link>
            </div>

            <p className="text-xs text-ash leading-relaxed max-w-xl pt-2 border-t border-edge/60">
              Independent community product. SayMyName.in is not owned, operated, or endorsed by
              IIT Madras. Registration requires an 18+ adult confirmation and active non-campus
              BS verification.
            </p>
          </div>

          {/* Right 5 Columns: Original "THE INTERVAL" Architectural Structural Diagram */}
          <div className="lg:col-span-5">
            <div className="relative bg-coal/92 border border-edge rounded-[12px] p-6 sm:p-7 smn-surface-elevated">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-ember/35 to-transparent"
              />
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-edge">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ash font-semibold">
                    The Interval Architecture
                  </p>
                  <p className="text-sm font-semibold text-chalk mt-0.5">
                    Distance Bridged by Verified Gates
                  </p>
                </div>
                <span className="px-2 py-1 text-[11px] font-mono bg-iron border border-edge rounded-[4px] text-iris">
                  v1.0
                </span>
              </div>

              {/* Architectural Geometric SVG (Mineral Night hairlines, Iris convergence, Ember warm marker) */}
              <div
                className="bg-void border border-edge/80 rounded-[8px] p-4 mb-5"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 360 156"
                  className="w-full h-auto block"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Coordinate horizontal grid hairlines */}
                  <line x1="16" y1="24" x2="344" y2="24" stroke="#222831" strokeWidth="1" />
                  <line x1="16" y1="78" x2="344" y2="78" stroke="#343D48" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="16" y1="132" x2="344" y2="132" stroke="#222831" strokeWidth="1" />

                  {/* Left Member Frame (Learner Node A) */}
                  <rect x="20" y="34" width="66" height="88" rx="6" fill="#12161B" stroke="#343D48" strokeWidth="1.25" />
                  <rect x="31" y="47" width="44" height="6" rx="2" fill="#252D37" />
                  <rect x="31" y="61" width="28" height="4" rx="2" fill="#8580C4" />
                  <rect x="31" y="102" width="44" height="8" rx="2" fill="#1A2027" stroke="#343D48" strokeWidth="1" />

                  {/* Interval Threshold Gate Bars */}
                  <line x1="130" y1="24" x2="130" y2="132" stroke="#343D48" strokeWidth="1.25" />
                  <rect x="126" y="68" width="8" height="20" rx="2" fill="#8580C4" />

                  <line x1="180" y1="24" x2="180" y2="132" stroke="#8580C4" strokeWidth="1.5" />
                  <rect x="174" y="64" width="12" height="28" rx="2" fill="#E18A62" />

                  <line x1="230" y1="24" x2="230" y2="132" stroke="#343D48" strokeWidth="1.25" />
                  <rect x="226" y="68" width="8" height="20" rx="2" fill="#77C5A1" />

                  {/* Connecting Signal Path */}
                  <path d="M86 78 L174 78" stroke="#8580C4" strokeWidth="1.75" />
                  <path d="M186 78 L274 78" stroke="#E18A62" strokeWidth="1.75" />

                  {/* Right Member Frame (Learner Node B) */}
                  <rect x="274" y="34" width="66" height="88" rx="6" fill="#12161B" stroke="#343D48" strokeWidth="1.25" />
                  <rect x="285" y="47" width="44" height="6" rx="2" fill="#252D37" />
                  <rect x="285" y="61" width="28" height="4" rx="2" fill="#E18A62" />
                  <rect x="285" y="102" width="44" height="8" rx="2" fill="#1A2027" stroke="#343D48" strokeWidth="1" />
                </svg>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between px-3 py-2 bg-iron/70 border border-edge rounded-[6px]">
                  <span className="text-silver font-medium">Minimum Eligibility</span>
                  <span className="text-chalk font-semibold">18+ · 4 Approved BS Tracks</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 bg-iron/70 border border-edge rounded-[6px]">
                  <span className="text-silver font-medium">Messaging Gate</span>
                  <span className="text-chalk font-semibold">Active Mutual Match Required</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 bg-iron/70 border border-edge rounded-[6px]">
                  <span className="text-silver font-medium">Shared Continuity</span>
                  <span className="text-ember font-semibold">Opt-In Relationship Mode</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FOUR VERIFICATION & ONBOARDING GATES */}
      <section className="border-b border-edge bg-coal/40">
        <div className="container-wide py-14 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-1.5">
                Verification Sequence
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-chalk">
                Default-deny access before Discover
              </h2>
            </div>
            <Link
              href="/eligibility"
              className="text-xs font-semibold text-silver hover:text-chalk transition-colors"
            >
              Read full eligibility rules →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VERIFICATION_GATES.map((gate) => (
              <div
                key={gate.step}
                className="bg-coal border border-edge rounded-[10px] p-5 flex flex-col gap-3 smn-surface-elevated transition-colors duration-180 hover:border-[#4A5665]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-iris px-2 py-0.5 rounded-[4px] bg-iron border border-edge">
                    {gate.step}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-chalk">{gate.title}</h3>
                <p className="text-xs sm:text-sm text-silver leading-relaxed">{gate.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: APPROVED PHASE 1 COHORT FAMILIES */}
      <section className="border-b border-edge">
        <div className="container-wide py-14 sm:py-16">
          <div className="max-w-2xl mb-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ember font-semibold mb-1.5">
              Phase 1 Academic Scope
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-chalk mb-2">
              Four approved IIT Madras non-campus BS cohorts
            </h2>
            <p className="text-sm text-silver leading-relaxed">
              Campus-only degrees, alumni from other universities, and general institutional
              accounts remain outside Phase 1 scope.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROGRAMME_FAMILIES.map((prog) => (
              <div
                key={prog.code}
                className="bg-coal border border-edge rounded-[10px] p-6 flex flex-col justify-between gap-4 hover:border-[#4A5665] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-mono font-semibold text-silver px-2.5 py-1 bg-iron border border-edge rounded-[4px]">
                      {prog.code}
                    </span>
                    <span className="text-[11px] text-ash font-medium">{prog.pathways}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-chalk mb-1.5">{prog.title}</h3>
                  <p className="text-sm text-silver leading-relaxed">{prog.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: CONSENT & SAFETY ARCHITECTURE */}
      <section>
        <div className="container-wide py-14 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-1.5">
                Consent Commitments
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-chalk mb-3">
                Built against unwanted contact and coercive design
              </h2>
              <p className="text-sm text-silver leading-relaxed mb-5">
                No endless swipe loops, no unverified messaging, and no hidden surveillance once
                you move into Relationship Mode.
              </p>
              <Link href="/safety">
                <Button variant="secondary" size="md">
                  Review Safety Architecture
                </Button>
              </Link>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CONSENT_INVARIANTS.map((item) => (
                <div
                  key={item.label}
                  className="bg-coal border border-edge rounded-[10px] p-5 flex flex-col gap-2.5 smn-surface-elevated transition-colors duration-180 hover:border-[#4A5665]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris">
                    {item.label}
                  </p>
                  <h3 className="text-base font-semibold text-chalk">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-silver leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
