import React from 'react';
import Link from 'next/link';
import { TRUST_RULES } from './landing-content';

/**
 * Band 6: Privacy & Trust Promises (#trust).
 * Human-first articulation of mutual consent, default-deny privacy, and independence.
 */
export function TrustSection() {
  return (
    <section
      id="trust"
      aria-labelledby="trust-heading"
      className="bg-coal border-b border-edge/80 py-16 md:py-24"
    >
      <div className="container-wide flex flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
              SAFETY &amp; CONSENT
            </p>
            <h2
              id="trust-heading"
              className="text-2xl sm:text-[2rem] lg:text-[2.25rem] font-semibold leading-[1.15] tracking-[-0.025em] text-chalk"
            >
              Designed so every boundary holds even under stress.
            </h2>
          </div>
          <Link
            href="/safety"
            className="text-sm font-medium text-iris hover:text-iris-hover transition-colors self-start md:self-auto"
          >
            Read Safety &amp; Consent Charter &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TRUST_RULES.map((rule) => (
            <article
              key={rule.id}
              className="rounded-[12px] border border-edge bg-void/90 p-6 flex flex-col gap-3"
            >
              <h3 className="text-base font-semibold text-chalk leading-snug">{rule.title}</h3>
              <p className="text-sm text-silver leading-[1.6]">{rule.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
