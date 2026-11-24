import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * SayMyName Quiet Empty State (Document 10, Section 05 & 20)
 * - Empty states are normal product states, never failures
 * - Zero artificial urgency, zero fake filler content
 * - Clean architectural composition with clear primary action
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-edge/60 bg-coal/50 rounded-[12px] max-w-lg mx-auto ${className}`}
    >
      {icon ? (
        <div className="w-12 h-12 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-silver mb-4">
          {icon}
        </div>
      ) : (
        <div className="w-12 h-12 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-ash mb-4">
          {/* Default Interval Symbol outline */}
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      )}

      <h3 className="text-base font-semibold text-chalk tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-silver max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
