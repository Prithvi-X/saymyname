import React from 'react';

export interface PageHeaderProps {
  /** Calm sentence-case context label (minimum 12–13px, never micro-uppercase clutter). */
  contextLabel?: string;
  /** Semantic indicator dot color beside the context label. */
  accent?: 'iris' | 'ember' | 'neutral';
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Architectural Page Header (Milestone 1 — THE INTERVAL)
 * Provides a calm sentence-case context indicator, clear heading.1 hierarchy,
 * readable 14px description, and balanced right-aligned utility actions.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  contextLabel,
  accent = 'iris',
  title,
  description,
  actions,
  className = '',
}) => {
  const dotClass =
    accent === 'ember'
      ? 'bg-ember'
      : accent === 'neutral'
        ? 'bg-edge'
        : 'bg-iris';

  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-edge ${className}`}
    >
      <div className="min-w-0">
        {contextLabel && (
          <div className="flex items-center gap-2 text-[13px] font-medium text-silver mb-1.5">
            <span className={`inline-block w-2 h-2 rounded-[2px] shrink-0 ${dotClass}`} aria-hidden="true" />
            <span>{contextLabel}</span>
          </div>
        )}
        <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold text-chalk tracking-[-0.02em] leading-[1.12]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-silver mt-1.5 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};
