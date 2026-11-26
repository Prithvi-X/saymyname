import React from 'react';
import { ThresholdMark } from '../brand/ThresholdMark';
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
 * Document 10 (THE INTERVAL) Calm Architectural Empty State
 * Uses twin stepped ThresholdMark forms separated across a quiet interval rather than
 * technical diagnostics boxes, upper-case telemetry labels, or generic alert tiles.
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
      ? 'var(--smn-warning, #E6BC69)'
      : variant === 'likes' || variant === 'matches'
        ? 'var(--smn-accent-ember, #E18A62)'
        : 'var(--smn-accent-iris, #8580C4)';

  return (
    <section
      data-testid={testId}
      className="rounded-[12px] border border-edge bg-coal overflow-hidden"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 p-6 sm:p-9 lg:p-12 items-center">
        {/* Left 7 Columns: Calm Editorial Copy & Explicit Next Actions */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-w-0">
          <div className="inline-flex items-center gap-2 self-start text-[13px] font-medium text-silver">
            <span
              className="w-2 h-2 rounded-[2px] shrink-0"
              style={{ backgroundColor: accentColor }}
              aria-hidden="true"
            />
            <span>{eyebrow}</span>
          </div>

          <h2 className="text-2xl sm:text-[1.85rem] font-semibold text-chalk tracking-[-0.02em] leading-[1.15]">
            {title}
          </h2>

          <p className="text-sm sm:text-base text-silver leading-relaxed max-w-xl">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 mt-2 border-t border-edge">
              {facts.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-silver/80">
                    {fact.label}
                  </span>
                  <span className="text-sm text-chalk">{fact.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 5 Columns: Sculptural Two-Form Threshold Composition */}
        <div
          aria-hidden="true"
          className="lg:col-span-5 rounded-[10px] border border-edge bg-stage px-6 py-10 sm:py-12 flex flex-col items-center justify-center gap-4"
        >
          <ThresholdMark
            variant={variant === 'paused' ? 'separated' : 'separated'}
            size="lg"
          />
          <p className="text-[13px] text-silver/80 text-center max-w-[24ch] leading-snug">
            {variant === 'paused' && 'Your profile rests off the floor while discovery is paused.'}
            {variant === 'discover' && 'Quiet between batches while filters stay reciprocal.'}
            {variant === 'likes' && 'Incoming and sent interest wait here without pressure.'}
            {variant === 'matches' && 'Mutual matches unlock a private channel when interest aligns.'}
            {variant === 'chats' && 'Private messaging begins once both peers choose each other.'}
          </p>
        </div>
      </div>
    </section>
  );
};
