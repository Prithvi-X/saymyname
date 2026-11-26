import React from 'react';
import Link from 'next/link';
import { ONBOARDING_STEPS } from './landing-content';

/**
 * Band 4: How Verification & Onboarding Work (#how-it-works).
 * Accurately reflects the real five-step Phase 1 onboarding sequence and manual review gate.
 */
export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="bg-coal border-b border-edge/80 py-16 md:py-24"
    >
      <div className="container-wide flex flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-iris">
              HOW IT WORKS
            </p>
            <h2
              id="how-it-works-heading"
              className="text-2xl sm:text-[2rem] lg:text-[2.25rem] font-semibold leading-[1.15] tracking-[-0.025em] text-chalk"
            >
              Five deliberate steps from signup to Discover.
            </h2>
          </div>
          <Link
            href="/eligibility"
            className="text-sm font-medium text-iris hover:text-iris-hover transition-colors self-start md:self-auto"
          >
            Read full Eligibility Guide &rarr;
          </Link>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ONBOARDING_STEPS.map((item) => (
            <li
              key={item.step}
              className="rounded-[12px] border border-edge bg-void/90 p-5 flex flex-col gap-3"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
                Step {item.step}
              </span>
              <h3 className="text-base font-semibold text-chalk leading-snug">{item.title}</h3>
              <p className="text-sm text-silver leading-relaxed">{item.detail}</p>
            </li>
          ))}
        </ol>

        <div className="rounded-[8px] border border-edge bg-void/70 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-silver leading-relaxed">
            Age (18+) and IITM BS student checks undergo manual review before Discover unlocks — accounts are never granted instant automatic admission.
          </p>
          <Link
            href="/onboarding"
            className="text-sm font-semibold text-chalk hover:text-iris whitespace-nowrap transition-colors"
          >
            Start Onboarding &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
