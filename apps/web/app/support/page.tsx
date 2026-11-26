import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { getConfiguredSupportEmail } from '../../lib/public-config';
import { Button } from '../../components/ui';

export const metadata: Metadata = {
  title: 'Member Support & Account Recovery',
  description:
    'Password reset, verification review status lookup, and safety escalation resources for SayMyName.in members.',
  alternates: {
    canonical: '/support',
  },
};

export default function SupportPage() {
  const supportEmail = getConfiguredSupportEmail();

  return (
    <div className="bg-void text-chalk font-ui">
      <div className="container-standard py-12 sm:py-16">
        <div className="mb-8 pb-6 border-b border-edge">
          <p className="text-[13px] text-iris font-medium mb-2">
            Member support
          </p>
          <h1 className="text-3xl font-semibold text-chalk tracking-[-0.02em] mb-2">
            Account Recovery, Verification &amp; Safety Help
          </h1>
          <p className="text-sm text-silver">
            Self-service recovery paths and support desk status for verified learners.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-coal border border-edge rounded-[10px] p-6 flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-chalk mb-1.5">
                Password &amp; Session Recovery
              </h2>
              <p className="text-xs sm:text-sm text-silver leading-relaxed">
                Forgot your passphrase or migrating from an earlier login flow? Resetting your
                password issues a single-use institutional recovery link and clears older sessions.
              </p>
            </div>
            <Link href="/forgot-password">
              <Button variant="secondary" size="sm">
                Reset Password →
              </Button>
            </Link>
          </div>

          <div className="bg-coal border border-edge rounded-[10px] p-6 flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-chalk mb-1.5">
                Verification Review Status
              </h2>
              <p className="text-xs sm:text-sm text-silver leading-relaxed">
                Sign in to view your current verification queue state, resubmit missing enrolment
                information, or manage your draft onboarding steps.
              </p>
            </div>
            <Link href="/onboarding">
              <Button variant="secondary" size="sm">
                Check Verification Status →
              </Button>
            </Link>
          </div>
        </div>

        <section className="bg-coal border border-edge rounded-[10px] p-6">
          <h2 className="text-base font-semibold text-chalk mb-2">
            Direct Support &amp; Safety Escalation Channel
          </h2>
          {supportEmail ? (
            <p className="text-sm text-silver leading-relaxed">
              For verification questions, account erasure requests, or urgent safety reports,
              contact:{' '}
              <a href={`mailto:${supportEmail}`} className="text-iris font-semibold underline">
                {supportEmail}
              </a>
            </p>
          ) : (
            <p className="text-sm text-silver leading-relaxed">
              Our monitored support mailbox is currently being provisioned and is not yet active on
              this environment. Inside the app, instant{' '}
              <Link href="/safety" className="text-iris underline">
                Block &amp; Report controls
              </Link>{' '}
              immediately isolate affected accounts on the server while moderation queues review
              safety cases.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
