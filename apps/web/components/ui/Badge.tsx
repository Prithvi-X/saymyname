import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'verified' | 'programme' | 'neutral' | 'accent' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

/**
 * SayMyName Badge Component (Document 10, Section 11 & User Requirement)
 * - Compact architectural rectangular badge (4px radius)
 * - STRICTLY NO 999px pill badges
 * - Explicit user requirement: "Verified" only (no "18+ Student")
 * - High legibility on dark surfaces
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5 gap-1 rounded-[3px]',
    md: 'text-xs px-2.5 py-1 gap-1.5 rounded-[4px]',
  };

  const variantStyles = {
    verified:
      'bg-[#10241A] text-success border border-success/30 font-medium',
    programme:
      'bg-iron text-silver border border-edge font-medium',
    neutral:
      'bg-coal text-ash border border-edge/80',
    accent:
      'bg-[#1C1C2E] text-iris border border-iris/30 font-medium',
    warning:
      'bg-[#2B2211] text-warning border border-warning/30 font-medium',
    danger:
      'bg-[#2E1417] text-danger border border-danger/30 font-medium',
  };

  // Default verified icon (architectural checkmark)
  const defaultVerifiedIcon = (
    <svg className="w-3 h-3 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <span
      className={`inline-flex items-center font-ui tracking-wide select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {variant === 'verified' && (icon || defaultVerifiedIcon)}
      {variant !== 'verified' && icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
