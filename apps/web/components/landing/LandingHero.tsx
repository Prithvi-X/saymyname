import React from 'react';
import Link from 'next/link';
import { Button } from '../ui';
import {
  HERO_CANDIDATES,
  HERO_INDEPENDENCE_DISCLOSURE,
  HERO_TRUST_SUMMARY,
} from './landing-content';
import type { HeroCompositionMode, HeroHeadlineCandidateId } from './landing-types';

export interface LandingHeroProps {
  candidateId?: HeroHeadlineCandidateId;
  compositionMode?: HeroCompositionMode;
}

/**
 * Band 1: Opening Editorial Romance Hero (Document 10).
 * Defaults to interim 3D-led Two Lights atmosphere until commissioned IMG-01 photography is approved.
 */
export function LandingHero({
  candidateId = 'A',
  compositionMode = '3d-led',
}: LandingHeroProps) {
  const copy = HERO_CANDIDATES[candidateId];

  return (
    <section
      aria-labelledby="landing-hero-heading"
      data-hero-composition={compositionMode}
      className="relative overflow-hidden bg-void border-b border-edge/80"
    >
      {/* Two Lights Atmospheric Layer (3D-01) */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <picture className="block w-full h-full">
          <source
            media="(max-width: 767px)"
            srcSet="/images/landing/3d/two-lights-mobile-10bit.avif"
            type="image/avif"
          />
          <source
            media="(max-width: 767px)"
            srcSet="/images/landing/3d/two-lights-mobile.webp"
            type="image/webp"
          />
          <source
            srcSet="/images/landing/3d/two-lights-desktop-10bit.avif"
            type="image/avif"
          />
          <img
            src="/images/landing/3d/two-lights-desktop.webp"
            alt=""
            width={1440}
            height={900}
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover object-center opacity-85 select-none"
          />
        </picture>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(96deg, rgba(11,13,16,0.96) 0%, rgba(11,13,16,0.88) 46%, rgba(11,13,16,0.44) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, #0B0D10 100%)',
          }}
        />
      </div>

      <div className="relative container-wide py-16 sm:py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Primary Editorial Narrative */}
          <div className="lg:col-span-7 flex flex-col items-start gap-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-iris">
              {copy.eyebrow}
            </p>

            <h1
              id="landing-hero-heading"
              className="text-[2.15rem] sm:text-[2.85rem] lg:text-[3.5rem] font-semibold tracking-[-0.03em] leading-[1.07] text-chalk max-w-2xl"
            >
              {copy.headline}
            </h1>

            <p className="text-base sm:text-[1.125rem] leading-[1.6] text-silver max-w-xl">
              {copy.subheadline}
            </p>

            {/* Primary & Secondary Action Pair (min 44px height) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 w-full sm:w-auto pt-1">
              <Link href="/onboarding" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full sm:w-auto min-w-[180px]">
                  Create Account
                </Button>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-[8px] border border-edge bg-coal/75 text-sm font-medium text-silver hover:text-chalk hover:border-[#4A5665] transition-colors"
              >
                <span>See how it works</span>
                <span aria-hidden="true">&darr;</span>
              </a>
            </div>

            {/* Grounded Trust & Non-Affiliation Micro-Block */}
            <div className="pt-3 border-t border-edge/70 w-full max-w-xl flex flex-col gap-1.5">
              <p className="text-xs font-medium text-chalk/90">{HERO_TRUST_SUMMARY}</p>
              <p className="text-xs text-ash leading-relaxed">{HERO_INDEPENDENCE_DISCLOSURE}</p>
            </div>
          </div>

          {/* Right Composition Frame: Restrained Two Lights Focal Study */}
          <div className="lg:col-span-5">
            <div className="rounded-[12px] border border-edge bg-coal/80 p-3 sm:p-4 smn-surface-elevated">
              <div className="relative aspect-[4/3] sm:aspect-[16/11] lg:aspect-[5/4] rounded-[8px] overflow-hidden border border-white/[0.06] bg-void">
                <img
                  src="/images/landing/3d/two-lights-detail.webp"
                  alt="Two warm amber and cool iris light spheres meeting gently in quiet darkness — visual metaphor for mutual connection across distance."
                  width={960}
                  height={768}
                  decoding="async"
                  className="w-full h-full object-cover object-center"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(11,13,16,0.08) 0%, rgba(11,13,16,0.72) 100%)',
                  }}
                />
                <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ember">
                    Two Lights · Editorial Direction
                  </span>
                  <p className="text-sm text-chalk font-medium leading-snug">
                    Mutual curiosity across cities, without crowded rooms or cold DMs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
