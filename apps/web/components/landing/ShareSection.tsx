'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '../ui';
import { PEER_SHARE_CANONICAL_URL, SHARE_SECTION_CONTENT } from './landing-content';

/**
 * Band 7: Peer Sharing & Final Action (#share).
 * Copies clean canonical URL (https://saymyname.in) with zero tracking or ?src=peer until DEC-LP-05.
 */
export function ShareSection() {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleShare() {
    setFeedback(null);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: SHARE_SECTION_CONTENT.shareTitle,
          text: SHARE_SECTION_CONTENT.shareText,
          url: PEER_SHARE_CANONICAL_URL,
        });
        setFeedback('Share sheet opened for https://saymyname.in');
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(PEER_SHARE_CANONICAL_URL);
        setFeedback('Link copied cleanly: https://saymyname.in');
        return;
      } catch {
        // Fallback below when clipboard access is blocked
      }
    }

    setFeedback('Share this clean link: https://saymyname.in');
  }

  return (
    <section
      id="share"
      aria-labelledby="share-heading"
      className="bg-void py-16 md:py-24"
    >
      <div className="container-wide">
        <div className="rounded-[12px] border border-edge bg-coal px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14 flex flex-col lg:flex-row lg:items-center justify-between gap-8 smn-surface-elevated">
          <div className="flex flex-col gap-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-iris">
              {SHARE_SECTION_CONTENT.eyebrow}
            </p>
            <h2
              id="share-heading"
              className="text-2xl sm:text-[2rem] font-semibold leading-[1.15] tracking-[-0.025em] text-chalk"
            >
              {SHARE_SECTION_CONTENT.headline}
            </h2>
            <p className="text-base text-silver leading-[1.6]">{SHARE_SECTION_CONTENT.body}</p>
          </div>

          <div className="flex flex-col items-stretch sm:items-start lg:items-end gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Link href="/onboarding" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full sm:w-auto min-w-[176px]">
                  {SHARE_SECTION_CONTENT.primaryCta}
                </Button>
              </Link>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={handleShare}
                className="w-full sm:w-auto min-w-[176px]"
              >
                {SHARE_SECTION_CONTENT.secondaryCta}
              </Button>
            </div>
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-silver min-h-[1.25rem]"
            >
              {feedback ?? 'Clean link without tracking parameters: https://saymyname.in'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
