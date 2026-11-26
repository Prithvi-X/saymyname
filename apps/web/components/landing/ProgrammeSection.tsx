import React from 'react';
import Link from 'next/link';
import { APPROVED_PROGRAMME_FAMILIES } from './landing-content';

/**
 * Band 5: Four Approved Programmes (#community).
 * Ruled ledger layout strictly enforcing the four approved non-campus BS tracks.
 */
export function ProgrammeSection() {
  return (
    <section
      id="community"
      aria-labelledby="programmes-heading"
      className="bg-void border-b border-edge/80 py-16 md:py-24"
    >
      <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-5 flex flex-col gap-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-iris">
            ELIGIBLE COHORTS
          </p>
          <h2
            id="programmes-heading"
            className="text-2xl sm:text-[2rem] lg:text-[2.25rem] font-semibold leading-[1.15] tracking-[-0.025em] text-chalk"
          >
            Built exclusively for the four IIT Madras non-campus BS programmes.
          </h2>
          <p className="text-base text-silver leading-[1.65]">
            SayMyName focuses exclusively on adults (18+) currently enrolled in these four approved non-campus programme families. Campus degrees, alumni cohorts, and external universities are excluded in Phase 1.
          </p>
          <div className="pt-2">
            <Link
              href="/eligibility"
              className="text-sm font-medium text-iris hover:text-iris-hover transition-colors"
            >
              Review programme &amp; verification criteria &rarr;
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-[12px] border border-edge bg-coal divide-y divide-edge/80">
            {APPROVED_PROGRAMME_FAMILIES.map((programme) => (
              <div
                key={programme.code}
                className="px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-baseline gap-4">
                  <span className="text-[12px] font-semibold tracking-[0.12em] text-ember shrink-0">
                    {programme.code}
                  </span>
                  <h3 className="text-base font-semibold text-chalk">{programme.name}</h3>
                </div>
                <p className="text-[12px] font-medium text-silver pl-8 sm:pl-0">
                  {programme.scopeNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
