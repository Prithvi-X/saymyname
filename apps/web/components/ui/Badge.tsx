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
    sm: 'text-xs px-2 py-0.5 gap-1.5 rounded-[4px]',
    md: 'text-[13px] px-2.5 py-1 gap-1.5 rounded-[4px]',
  };

  const variantStyles = {
    verified:
      'bg-[#10241A] text-success border border-[#396A56] font-medium',
    programme:
      'bg-iron text-silver border border-edge font-medium',
    neutral:
      'bg-coal text-silver border border-edge/90',
    accent:
      'bg-[#1C1C2E] text-iris border border-iris/35 font-medium',
    warning:
      'bg-[#2B2211] text-warning border border-warning/35 font-medium',
    danger:
      'bg-[#2E1417] text-danger border border-danger/35 font-medium',
  };

  // Default verified icon (architectural checkmark, strictly fixed 12px)
  const defaultVerifiedIcon = (
    <svg width={12} height={12} style={{ width: '12px', height: '12px', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
