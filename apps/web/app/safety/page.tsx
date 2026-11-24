import React from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui';

const ENFORCED_CONTROLS = [
  {
    code: 'CTRL-01',
    title: 'Server-side Default-Deny Eligibility Guard',
    detail:
      'Every dating, messaging, calling, and Relationship Mode API endpoint verifies active account status plus approved 18+ age and BS student status in PostgreSQL—never trusting client claims or cached UI state.',
  },
  {
    code: 'CTRL-02',
    title: 'Mutual Match Before Private Messaging',
    detail:
      'Sending a Like does not open a chat thread. Conversations are created server-side strictly when both verified adults express reciprocal interest and no block exists.',
  },
  {
    code: 'CTRL-03',
    title: 'Instant Block & Unmatch Termination',
    detail:
      'Blocking a user executes atomically on the server: it ends any active match, closes conversation access, removes discovery visibility, and halts shared Relationship Mode interaction.',
  },
  {
    code: 'CTRL-04',
    title: 'Bilateral Consent for Voice & Shared Spaces',
    detail:
      'Audio calls, cohort mini-games, and virtual date proposals require an explicit invitation and explicit partner acceptance before LiveKit tokens or shared rooms issue.',
  },
  {
    code: 'CTRL-05',
    title: 'Unilateral Relationship Mode Exit',
    detail:
      'Relationship Mode requires two independent affirmative actions to begin, yet either partner can pause or exit independently at any time without requiring partner permission.',
  },
  {
    code: 'CTRL-06',
    title: 'Private R2 Storage for Portrait Photos',
    detail:
      'Member portrait images reside inside private Cloudflare R2 buckets and are hydrated solely via short-lived authorised signed URLs—never public static URLs or unverified third-party links.',
  },
];

const POLICY_COMMITMENTS = [
  'Zero real-time GPS or exact location sharing—profiles display coarse city and state only.',
  'No default audio or video call recording.',
  'Private messages, voice notes, and relationship journal entries are never used for advertising or external model training.',
  'No unsolicited stranger DMs, anonymous roulette, or public social feeds.',
  'Student enrolment data and verification cases remain isolated from your public Discover card.',
];

export default function SafetyPage() {
  return (
    <div className="bg-void text-chalk font-ui">
      <div className="container-standard py-12 sm:py-16">
        <div className="mb-10 pb-8 border-b border-edge">
          <p className="text-[11px] uppercase tracking-[0.14em] text-iris font-semibold mb-2">
            Trust, Safety &amp; Consent · Document 01 §3
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-chalk mb-3">
            Safety Architecture &amp; Consent Rules
          </h1>
          <p className="text-sm sm:text-base text-silver leading-relaxed max-w-2xl">
            We separate what is enforced directly in backend server guards today from operational
            and privacy commitments that govern platform conduct.
          </p>
        </div>

        {/* Section 1: Technical Enforcement */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-chalk mb-4">
            1. Enforced technical controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ENFORCED_CONTROLS.map((ctrl) => (
              <div
                key={ctrl.code}
                className="bg-coal border border-edge rounded-[10px] p-5 flex flex-col gap-2.5"
              >
                <span className="self-start font-mono text-[11px] font-semibold text-iris px-2 py-0.5 rounded-[4px] bg-iron border border-edge">
                  {ctrl.code}
                </span>
                <h3 className="text-base font-semibold text-chalk">{ctrl.title}</h3>
                <p className="text-xs sm:text-sm text-silver leading-relaxed">{ctrl.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Privacy & Operational Commitments */}
        <section className="mb-10 bg-coal border border-edge rounded-[10px] p-6">
          <p className="text-[11px] uppercase tracking-[0.12em] text-ember font-semibold mb-1.5">
            Platform Commitments
          </p>
          <h2 className="text-lg font-semibold text-chalk mb-4">
            Data minimisation &amp; member boundaries
          </h2>
          <ul className="space-y-3 text-xs sm:text-sm text-silver leading-relaxed">
            {POLICY_COMMITMENTS.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="text-iris font-bold mt-0.5">—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/privacy">
            <Button variant="secondary" size="md">
              Read Privacy Notice
            </Button>
          </Link>
          <Link href="/support">
            <Button variant="secondary" size="md">
              Safety &amp; Reporting Support
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
