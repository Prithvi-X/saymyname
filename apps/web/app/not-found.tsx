import React from 'react';
import Link from 'next/link';
import { ThresholdMark } from '../components/brand';
import { Button } from '../components/ui';

export default function NotFound() {
  return (
    <section
      aria-labelledby="not-found-heading"
      className="container-app py-14 sm:py-24 font-ui"
    >
      <div className="max-w-3xl mx-auto rounded-[12px] border border-edge bg-coal p-7 sm:p-10 grid grid-cols-1 sm:grid-cols-12 gap-8 items-center">
        <div className="sm:col-span-4 flex flex-col items-start gap-4 border-b sm:border-b-0 sm:border-r border-edge pb-6 sm:pb-0 sm:pr-6">
          <ThresholdMark variant="separated" size="md" />
          <p className="text-[13px] font-medium text-silver">404 · Route unavailable</p>
        </div>

        <div className="sm:col-span-8 flex flex-col gap-4">
          <h1
            id="not-found-heading"
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-chalk"
          >
            This page is outside the directory.
          </h1>
          <p className="text-sm sm:text-base text-silver leading-relaxed">
            The route you opened may have moved or does not exist. Return to the main site or continue to member sign-in.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/">
              <Button variant="primary" size="lg">
                Return Home
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">
                Member Sign In
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-4 pt-3 border-t border-edge/80 text-[13px] text-silver">
            <Link href="/eligibility" className="hover:text-chalk transition-colors">
              Eligibility Guide
            </Link>
            <Link href="/safety" className="hover:text-chalk transition-colors">
              Safety &amp; Consent
            </Link>
            <Link href="/support" className="hover:text-chalk transition-colors">
              Member Support
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
