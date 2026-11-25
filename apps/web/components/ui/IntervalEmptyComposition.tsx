import React from 'react';
import { Button } from './Button';

export interface IntervalEmptyAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'warm';
  disabled?: boolean;
  isLoading?: boolean;
  testId?: string;
}

export interface IntervalEmptyFact {
  label: string;
  value: string;
}

export interface IntervalEmptyCompositionProps {
  eyebrow: string;
  title: string;
  description: string;
  variant: 'discover' | 'paused' | 'likes' | 'matches' | 'chats';
  primaryAction?: IntervalEmptyAction;
  secondaryAction?: IntervalEmptyAction;
  facts?: IntervalEmptyFact[];
  testId?: string;
}

/**
 * Document 10 (THE INTERVAL) Broad Empty-State Composition
 * Replaces generic centered icon boxes with an intentional 12-column editorial layout.
 * Uses only factual account/route state — never invents stats or decorative filler.
 */
export const IntervalEmptyComposition: React.FC<IntervalEmptyCompositionProps> = ({
  eyebrow,
  title,
  description,
  variant,
  primaryAction,
  secondaryAction,
  facts = [],
  testId,
}) => {
  const accentColor =
    variant === 'paused'
      ? '#E6BC69'
      : variant === 'likes' || variant === 'matches'
        ? '#E18A62'
        : '#8580C4';

  return (
    <section
      data-testid={testId}
      className="relative rounded-[12px] border border-edge bg-coal/95 smn-surface-elevated overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-edge to-transparent"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 p-6 sm:p-9 lg:p-11 items-center">
        {/* Left 7 Columns: Calm Editorial Guidance & Real Actions */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-w-0">
          <div className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-[4px] bg-iron border border-edge text-[11px] font-semibold uppercase tracking-[0.13em] text-silver">
            <span
              className="w-1.5 h-1.5 shrink-0"
              style={{ backgroundColor: accentColor }}
              aria-hidden="true"
            />
            <span>{eyebrow}</span>
          </div>

          <h2 className="text-2xl sm:text-[1.75rem] font-semibold text-chalk tracking-tight leading-[1.15]">
            {title}
          </h2>

          <p className="text-sm sm:text-[15px] text-silver leading-relaxed max-w-xl">
            {description}
          </p>

          {(primaryAction || secondaryAction) && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {primaryAction && (
                <Button
                  variant={primaryAction.variant || 'primary'}
                  size="md"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  isLoading={primaryAction.isLoading}
                  data-testid={primaryAction.testId}
                >
                  {primaryAction.label}
                </Button>
              )}
              {secondaryAction && (
                <Button
                  variant={secondaryAction.variant || 'secondary'}
                  size="md"
                  onClick={secondaryAction.onClick}
                  disabled={secondaryAction.disabled}
                  isLoading={secondaryAction.isLoading}
                  data-testid={secondaryAction.testId}
                >
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}

          {facts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 mt-2 border-t border-edge/80">
              {facts.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-[0.1em] text-ash font-medium">
                    {fact.label}
                  </span>
                  <span className="text-xs sm:text-[13px] text-chalk">{fact.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 5 Columns: Architectural THE INTERVAL Diagram */}
        <div
          aria-hidden="true"
          className="lg:col-span-5 rounded-[10px] border border-edge/80 bg-stage p-5 sm:p-6 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-ash">
            <span className="uppercase tracking-[0.12em]">
              {variant === 'discover' && 'Queue Threshold'}
              {variant === 'paused' && 'Visibility Paused'}
              {variant === 'likes' && 'Private Queue'}
              {variant === 'matches' && 'Interval Alignment'}
              {variant === 'chats' && 'Match Channel Gate'}
            </span>
            <span style={{ color: accentColor }}>
              {variant === 'paused' ? 'HIDDEN' : 'ACTIVE RULE'}
            </span>
          </div>

          <svg
            viewBox="0 0 320 156"
            className="w-full h-auto block"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="12" y1="24" x2="308" y2="24" stroke="#1E242C" strokeWidth="1" />
            <line
              x1="12"
              y1="78"
              x2="308"
              y2="78"
              stroke="#343D48"
              strokeWidth="1"
              strokeDasharray={variant === 'paused' ? '4 4' : undefined}
            />
            <line x1="12" y1="132" x2="308" y2="132" stroke="#1E242C" strokeWidth="1" />

            {/* Left Architectural Frame */}
            <rect
              x="22"
              y="32"
              width="82"
              height="92"
              rx="6"
              fill="#12161B"
              stroke="#343D48"
              strokeWidth="1.25"
            />
            <rect x="36" y="48" width="44" height="5" rx="2" fill="#252D37" />
            <rect x="36" y="61" width="30" height="4" rx="2" fill="#8580C4" />
            <rect x="36" y="102" width="54" height="8" rx="2" fill="#1A2027" stroke="#343D48" />

            {/* Center Interval Gap / Gate */}
            <line x1="160" y1="24" x2="160" y2="132" stroke={accentColor} strokeWidth="1.25" strokeOpacity="0.65" />
            <rect
              x="154"
              y="64"
              width="12"
              height="28"
              rx="2"
              fill="#1A2027"
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <rect x="158" y="75" width="4" height="6" rx="1" fill={accentColor} />

            {/* Right Architectural Frame */}
            <rect
              x="216"
              y="32"
              width="82"
              height="92"
              rx="6"
              fill="#12161B"
              stroke={variant === 'paused' ? '#343D48' : accentColor}
              strokeOpacity={variant === 'paused' ? 0.5 : 0.65}
              strokeDasharray={variant === 'paused' ? '4 3' : undefined}
              strokeWidth="1.25"
            />
            <rect x="230" y="48" width="44" height="5" rx="2" fill="#252D37" />
            <rect x="230" y="61" width="30" height="4" rx="2" fill={accentColor} fillOpacity="0.85" />
            <rect x="230" y="102" width="54" height="8" rx="2" fill="#1A2027" stroke="#343D48" />
          </svg>
        </div>
      </div>
    </section>
  );
};
