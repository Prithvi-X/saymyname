import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'Independent platform status, strict 18+ and non-campus BS eligibility criteria, member conduct rules, and pre-launch governance for SayMyName.in.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="bg-void text-chalk font-ui">
      <div className="container-standard py-12 sm:py-16">
        <div className="mb-8 pb-6 border-b border-edge">
          <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-2">
            Terms of Use
          </p>
          <h1 className="text-3xl font-semibold text-chalk mb-2">
            Platform Eligibility &amp; Member Conduct
          </h1>
          <p className="text-sm text-silver">
            Core participation conditions for SayMyName.in Phase 1.
          </p>
        </div>

        <div className="space-y-6 text-sm text-silver leading-relaxed">
          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              1. Independent Platform Status
            </h2>
            <p>
              SayMyName.in is operated as an independent dating-first service for adult learners in
              IIT Madras non-campus BS programmes. It is not owned, endorsed, managed, or verified by
              the Indian Institute of Technology Madras.
            </p>
          </section>

          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              2. Strict 18+ &amp; Enrolment Eligibility
            </h2>
            <p>
              To create or maintain an account you must be at least 18 years old and actively enrolled
              in one of the four approved Phase 1 non-campus BS programme families as described on our{' '}
              <Link href="/eligibility" className="text-iris underline">
                Eligibility Guide
              </Link>
              . Misrepresenting age, institutional status, or identity will result in denial or
              suspension of access.
            </p>
          </section>

          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              3. Respectful Conduct &amp; Anti-Scraping Rules
            </h2>
            <p>
              Members agree not to harass other users, distribute private profile photos or chat
              contents outside the platform, impersonate another learner, or run automated scraping
              against profile or messaging endpoints. Any reported harassment or safety abuse is
              subject to moderation action including immediate account suspension.
            </p>
          </section>

          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              4. Service Availability &amp; Pre-Launch Legal Finalisation
            </h2>
            <p>
              SayMyName is currently in structured phased rollout. Formal operating entity disclosures
              and binding consumer dispute provisions are undergoing pre-launch legal review prior to
              open public launch.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
