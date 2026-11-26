import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { getConfiguredSupportEmail } from '../../lib/public-config';

export const metadata: Metadata = {
  title: 'Privacy Notice',
  description:
    'How SayMyName handles IIT Madras BS institutional email data, age and enrolment verification evidence, private portrait storage, and member privacy controls.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  const supportEmail = getConfiguredSupportEmail();

  return (
    <div className="bg-void text-chalk font-ui">
      <div className="container-standard py-12 sm:py-16">
        <div className="mb-8 pb-6 border-b border-edge">
          <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-2">
            Privacy Notice
          </p>
          <h1 className="text-3xl font-semibold text-chalk mb-2">
            How SayMyName handles your data
          </h1>
          <p className="text-sm text-silver">
            Independent Phase 1 privacy commitments governing onboarding, eligibility records, and
            dating interactions.
          </p>
        </div>

        <div className="space-y-6 text-sm text-silver leading-relaxed">
          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              1. Account &amp; Institutional Verification Data
            </h2>
            <p>
              We collect your approved IIT Madras BS study email address, a securely salted
              cryptographic password hash, your 18+ age eligibility check outcome, and your BS
              programme family and pathway level (Foundation, Diploma, or Degree). Verification case
              evidence, when submitted, is stored inside private access-controlled Cloudflare R2
              storage with time-bounded retention schedules and separated from public member cards.
            </p>
            <p className="mt-2.5 text-chalk">
              SayMyName does not collect or accept government-issued identity documents in the current
              release.
            </p>
          </section>

          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              2. Dating Profile &amp; Media Controls
            </h2>
            <p>
              Discover profiles show only what you intentionally publish: a chosen display name (never
              your institutional email prefix or roll number), optional academic context, coarse city
              and state, interests, prompts, and portrait photographs uploaded to private R2 storage
              and delivered via short-lived signed links. Precise GPS coordinates are never collected.
            </p>
          </section>

          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              3. Private Communications &amp; Security Logging
            </h2>
            <p>
              One-to-one messages, voice notes, audio call rooms, and Relationship Mode entries exist
              strictly for verified mutual matches. Audio calls are not recorded by default. Private
              communications are never shared with advertisers or used to train machine learning models.
            </p>
          </section>

          <section className="bg-coal border border-edge rounded-[10px] p-6">
            <h2 className="text-base font-semibold text-chalk mb-2">
              4. Governance &amp; Privacy Requests
            </h2>
            <p>
              You can pause Discover visibility, withdraw likes, unmatch, exit Relationship Mode, or
              revoke active sessions directly from account settings. Formal operating entity and
              statutory grievance officer publication details are being finalised alongside pre-launch
              legal review.
            </p>
            {supportEmail ? (
              <p className="mt-3 text-chalk">
                Configured privacy contact:{' '}
                <a href={`mailto:${supportEmail}`} className="text-iris underline">
                  {supportEmail}
                </a>
              </p>
            ) : (
              <p className="mt-3 text-ash">
                Direct email intake will appear here once the monitored support mailbox is configured.
                See <Link href="/support" className="text-iris underline">Member Support</Link> for
                account assistance.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
