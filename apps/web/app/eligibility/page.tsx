import React from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui';

const ELIGIBLE_TRACKS = [
  {
    code: 'BS-DSA',
    name: 'BS in Data Science and Applications',
    levels: ['Foundation', 'Diploma', 'Degree'],
    summary: 'Open to verified adult students actively pursuing any recognised BS-DSA level.',
  },
  {
    code: 'BS-ES',
    name: 'BS in Electronic Systems',
    levels: ['Foundation', 'Diploma', 'Degree'],
    summary: 'Open to verified adult students currently enrolled in the Electronic Systems track.',
  },
  {
    code: 'BS-AST',
    name: 'BS in Aeronautics and Space Technology',
    levels: ['Foundation', 'Diploma', 'Degree'],
    summary: 'Included among the four approved Phase 1 non-campus BS programme families.',
  },
  {
    code: 'BS-MDS',
    name: 'BS in Management and Data Science',
    levels: ['Foundation', 'Diploma', 'Degree'],
    summary: 'Included among the four approved Phase 1 non-campus BS programme families.',
  },
];

const IN_SCOPE_ITEMS = [
  'Adults aged 18 or older at the time of registration.',
  'Currently enrolled in Foundation, Diploma, or Degree level of one of the 4 approved non-campus BS tracks.',
  'Registered using an approved BS study inbox (@study.iitm.ac.in, @ds.study.iitm.ac.in, or @es.study.iitm.ac.in).',
  'Willing to complete age eligibility and enrolment review before accessing Discover.',
];

const OUT_OF_SCOPE_ITEMS = [
  'Anyone under 18 years old — regardless of admission to IIT Madras Foundation.',
  'General campus-only degree holders, alumni, or staff accounts using @iitm.ac.in / @smail.iitm.ac.in.',
  'Students outside IIT Madras non-campus BS programmes during Phase 1.',
  'Accounts relying solely on an email suffix without completing student verification review.',
];

export default function EligibilityPage() {
  return (
    <div className="bg-void text-chalk font-ui">
      <div className="container-standard py-12 sm:py-16">
        <div className="mb-10 pb-8 border-b border-edge">
          <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-2">
            Eligibility Specification · Document 01 §3
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-chalk mb-3">
            Who can join SayMyName Phase 1
          </h1>
          <p className="text-sm sm:text-base text-silver leading-relaxed max-w-2xl">
            Every account passes four sequential checks before Discover unlocks: approved BS
            institutional email confirmation, strict 18+ age check, non-campus BS enrolment
            review, and profile publication with an authentic portrait.
          </p>
        </div>

        {/* Section 1: Four Approved Families */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-chalk mb-4">
            1. Approved IIT Madras non-campus BS programme families
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ELIGIBLE_TRACKS.map((track) => (
              <div
                key={track.code}
                className="bg-coal border border-edge rounded-[10px] p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-iron border border-edge text-iris">
                    {track.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {track.levels.map((lvl) => (
                      <span
                        key={lvl}
                        className="text-[11px] px-2 py-0.5 rounded-[4px] bg-void border border-edge/80 text-silver"
                      >
                        {lvl}
                      </span>
                    ))}
                  </div>
                </div>
                <h3 className="text-base font-semibold text-chalk">{track.name}</h3>
                <p className="text-xs sm:text-sm text-silver leading-relaxed">{track.summary}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: In Scope vs Out of Scope */}
        <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-coal border border-success/30 rounded-[10px] p-6">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-success mb-2">
              In Scope (Phase 1)
            </p>
            <h2 className="text-lg font-semibold text-chalk mb-4">Eligible learners</h2>
            <ul className="space-y-3 text-xs sm:text-sm text-silver leading-relaxed">
              {IN_SCOPE_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-success font-bold mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-coal border border-danger/30 rounded-[10px] p-6">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-danger mb-2">
              Out of Scope
            </p>
            <h2 className="text-lg font-semibold text-chalk mb-4">Not permitted in Phase 1</h2>
            <ul className="space-y-3 text-xs sm:text-sm text-silver leading-relaxed">
              {OUT_OF_SCOPE_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-danger font-bold mt-0.5">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 3: Truthful Verification Boundary */}
        <section className="bg-iron border border-edge rounded-[10px] p-6 mb-10">
          <p className="text-[11px] uppercase tracking-[0.12em] text-warning font-semibold mb-1.5">
            Verification Boundary
          </p>
          <h2 className="text-lg font-semibold text-chalk mb-2">
            Email domains never verify active enrolment on their own
          </h2>
          <p className="text-sm text-silver leading-relaxed mb-4">
            Confirming ownership of an approved BS email address only completes account
            registration. Self-declared age and student programme details create a confidential
            verification case placed in <strong className="text-chalk">pending review</strong>{' '}
            until verified by an authorised reviewer or approved verification adapter. SayMyName
            does not expose a public student directory or institution lookup tool, and government
            ID documents are not requested in this onboarding stage.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/onboarding">
              <Button variant="primary" size="md">
                Begin Eligibility Onboarding
              </Button>
            </Link>
            <Link href="/safety">
              <Button variant="secondary" size="md">
                Review Safety Commitments
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
