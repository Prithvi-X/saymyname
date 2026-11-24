import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive' | 'warm';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * SayMyName Primary Button Component (Document 10, Section 11)
 * - Rectangular geometry with 8px radius (--smn-radius-control)
 * - Explicitly NO pill (999px) radius
 * - High contrast, tactile motion feedback (120ms standard)
 * - Accessible visible focus ring with offset
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-ui transition-all duration-120 ease-out select-none focus-visible:outline-2 focus-visible:outline-iris focus-visible:outline-offset-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

    const sizeStyles = {
      sm: 'h-9 px-3.5 text-xs gap-1.5 rounded-[6px]',
      md: 'h-12 px-5 text-sm gap-2 rounded-[8px]',
      lg: 'h-13 px-6 text-base gap-2.5 rounded-[8px]',
    };

    const variantStyles = {
      primary:
        'bg-iris text-stage hover:bg-[#9692D6] active:bg-[#7772B5] shadow-sm font-semibold',
      secondary:
        'bg-iron text-chalk border border-edge hover:bg-slate hover:border-[#465261] active:bg-[#202730]',
      tertiary:
        'bg-transparent text-silver hover:text-chalk hover:bg-coal active:bg-iron',
      ghost:
        'bg-transparent text-silver hover:text-chalk hover:bg-slate/40 active:bg-slate/70',
      destructive:
        'bg-[#301618] text-danger border border-danger/40 hover:bg-[#421C20] hover:border-danger active:bg-[#241012]',
      warm:
        'bg-ember text-stage hover:bg-[#EAA07D] active:bg-[#CF7852] font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing...</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
