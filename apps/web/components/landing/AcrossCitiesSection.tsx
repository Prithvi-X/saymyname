import React from 'react';
import { ACROSS_CITIES_CONTENT } from './landing-content';

/**
 * Band 2: Shared Journey Across Cities.
 * Uses an intentional Mineral Night meridian visual until commissioned IMG-02 street photography clears DEC-LP-02.
 */
export function AcrossCitiesSection() {
  return (
    <section
      aria-labelledby="across-cities-heading"
      className="bg-coal border-b border-edge/80 py-16 md:py-24"
    >
      <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Architectural Meridian Composition (zero uncommissioned stock placeholders) */}
        <div className="lg:col-span-6 order-2 lg:order-1">
          <div className="rounded-[12px] border border-edge bg-void p-6 sm:p-8 smn-surface-elevated">
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-edge/70">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-iris">
                Non-Campus Orbit
              </span>
              <span className="text-xs text-silver">Four BS Tracks · Nationwide</span>
            </div>

            <div className="py-7 sm:py-8 relative">
              <svg
                viewBox="0 0 460 190"
                className="w-full h-auto"
                role="img"
                aria-label="Minimal architectural diagram showing distant city nodes connected across a quiet evening meridian."
              >
                <defs>
                  <radialGradient id="cityAmber" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#E18A62" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#E18A62" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="cityIris" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#8580C4" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#8580C4" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Subtle Meridian Grid Lines */}
                <line x1="20" y1="44" x2="440" y2="44" stroke="#252D37" strokeWidth="1" />
                <line x1="20" y1="95" x2="440" y2="95" stroke="#252D37" strokeWidth="1" />
                <line x1="20" y1="146" x2="440" y2="146" stroke="#252D37" strokeWidth="1" />
                <line x1="120" y1="16" x2="120" y2="174" stroke="#1A2027" strokeWidth="1" />
                <line x1="230" y1="16" x2="230" y2="174" stroke="#252D37" strokeWidth="1" strokeDasharray="3 4" />
                <line x1="340" y1="16" x2="340" y2="174" stroke="#1A2027" strokeWidth="1" />

                {/* Connecting Calm Arc */}
                <path
                  d="M 88 128 C 165 44, 295 44, 372 78"
                  fill="none"
                  stroke="#8580C4"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                />

                {/* Soft Ambient Halos */}
                <circle cx="88" cy="128" r="28" fill="url(#cityAmber)" fillOpacity="0.35" />
                <circle cx="372" cy="78" r="28" fill="url(#cityIris)" fillOpacity="0.38" />

                {/* Node Markers */}
                <circle cx="88" cy="128" r="4.5" fill="#E18A62" />
                <circle cx="230" cy="64" r="3" fill="#B6BDC4" fillOpacity="0.7" />
                <circle cx="372" cy="78" r="4.5" fill="#8580C4" />

                {/* Typographic Labels */}
                <text x="64" y="156" fill="#F0F1EE" fontSize="11" fontFamily="Instrument Sans, sans-serif">
                  Bengaluru
                </text>
                <text x="206" y="42" fill="#B6BDC4" fontSize="11" fontFamily="Instrument Sans, sans-serif">
                  Mutual Match
                </text>
                <text x="358" y="102" fill="#F0F1EE" fontSize="11" fontFamily="Instrument Sans, sans-serif">
                  Chennai
                </text>
              </svg>
            </div>

            <div className="pt-4 border-t border-edge/70 flex flex-wrap gap-2">
              {ACROSS_CITIES_CONTENT.cities.map((city) => (
                <span
                  key={city}
                  className="px-2.5 py-1 rounded-[4px] border border-edge bg-iron text-xs font-medium text-silver"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Narrative Text Column */}
        <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col gap-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ember">
            {ACROSS_CITIES_CONTENT.eyebrow}
          </p>
          <h2
            id="across-cities-heading"
            className="text-2xl sm:text-[2rem] lg:text-[2.25rem] font-semibold leading-[1.15] tracking-[-0.025em] text-chalk"
          >
            {ACROSS_CITIES_CONTENT.headline}
          </h2>
          <p className="text-base leading-[1.65] text-silver">{ACROSS_CITIES_CONTENT.lead}</p>
          <p className="text-base leading-[1.65] text-silver">{ACROSS_CITIES_CONTENT.body}</p>
        </div>
      </div>
    </section>
  );
}
