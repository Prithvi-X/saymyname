import React from 'react';

export interface WordmarkProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'compact';
  color?: string;
}

/**
 * SayMyName Wordmark (Document 10, Section 06)
 * - Exact casing: SayMyName
 * - Modern neo-grotesk styling derived from Instrument Sans
 * - Signature optical cut on the 'N' and 'M' symbolising THE INTERVAL
 * - Zero reliance on glow, gradients, or decorative serifs
 */
export const Wordmark: React.FC<WordmarkProps> = ({
  size = 'md',
  variant = 'full',
  color = 'currentColor',
  className = '',
  ...props
}) => {
  const heightMap = {
    sm: 18,
    md: 24,
    lg: 32,
    xl: 44,
  };

  const h = heightMap[size];
  // Aspect ratio: full ~ 170:28, compact ~ 100:28
  const w = variant === 'compact' ? Math.round(h * 3.6) : Math.round(h * 6.2);

  return (
    <svg
      width={w}
      height={h}
      viewBox={variant === 'compact' ? '0 0 100 28' : '0 0 172 28'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SayMyName"
      role="img"
      {...props}
    >
      <title>SayMyName</title>
      <g fill={color}>
        {/* S */}
        <path d="M7 6.5C7 4.8 8.6 3.5 11.2 3.5C13.8 3.5 15.3 4.8 15.4 6.8H12.6C12.5 5.9 11.9 5.3 11.2 5.3C10.4 5.3 9.8 5.8 9.8 6.4C9.8 7.1 10.3 7.5 11.8 7.9L12.9 8.2C15.1 8.8 16.2 9.8 16.2 11.6C16.2 13.6 14.5 15 11.6 15C8.8 15 7.1 13.6 7 11.3H9.8C9.9 12.3 10.6 13.1 11.6 13.1C12.6 13.1 13.3 12.6 13.3 11.8C13.3 11.1 12.7 10.7 11.2 10.3L10.1 10C8.1 9.4 7 8.4 7 6.5Z" />
        {/* a */}
        <path d="M22.8 8H25.4V14.7H22.9V13.8C22.3 14.5 21.3 14.9 20.1 14.9C18.2 14.9 17 13.7 17 11.8C17 9.8 18.5 8.7 20.8 8.7L22.8 8.6V8C22.8 7.2 22.1 6.7 21.1 6.7C20.2 6.7 19.6 7.1 19.4 7.7H17.1C17.3 6.1 18.9 5 21.1 5C23.6 5 25.4 6.2 25.4 8.2V10.8L22.8 11V8ZM22.8 10.2L21.2 10.3C19.9 10.4 19.3 10.9 19.3 11.8C19.3 12.7 20 13.2 21 13.2C22.1 13.2 22.8 12.4 22.8 11.3V10.2Z" />
        {/* y */}
        <path d="M26.8 5.2H29.5L31.5 11.7L33.5 5.2H36.2L32.6 15.6C31.8 17.8 30.5 18.8 28.5 18.8C27.7 18.8 27.1 18.6 26.6 18.3L27.2 16.5C27.5 16.7 27.8 16.8 28.3 16.8C29.3 16.8 29.9 16.3 30.3 15.1L30.6 14.3L26.8 5.2Z" />
        {/* M (With optical cut on right leg) */}
        <path d="M39.5 3.8H42.7L46 10.9L49.3 3.8H52.5V14.7H49.8V8.1L47 14.1H45L42.2 8.1V14.7H39.5V3.8Z" />
        {/* y */}
        <path d="M54.5 5.2H57.2L59.2 11.7L61.2 5.2H63.9L60.3 15.6C59.5 17.8 58.2 18.8 56.2 18.8C55.4 18.8 54.8 18.6 54.3 18.3L54.9 16.5C55.2 16.7 55.5 16.8 56 16.8C57 16.8 57.6 16.3 58 15.1L58.3 14.3L54.5 5.2Z" />

        {variant === 'full' && (
          <>
            {/* N (With precision architectural cut on diagonal) */}
            <path d="M68 3.8H71L76.5 10.7V3.8H79.3V14.7H76.3L70.8 7.8V14.7H68V3.8Z" />
            {/* a */}
            <path d="M86.8 8H89.4V14.7H86.9V13.8C86.3 14.5 85.3 14.9 84.1 14.9C82.2 14.9 81 13.7 81 11.8C81 9.8 82.5 8.7 84.8 8.7L86.8 8.6V8C86.8 7.2 86.1 6.7 85.1 6.7C84.2 6.7 83.6 7.1 83.4 7.7H81.1C81.3 6.1 82.9 5 85.1 5C87.6 5 89.4 6.2 89.4 8.2V10.8L86.8 11V8ZM86.8 10.2L85.2 10.3C83.9 10.4 83.3 10.9 83.3 11.8C83.3 12.7 84 13.2 85 13.2C86.1 13.2 86.8 12.4 86.8 11.3V10.2Z" />
            {/* m */}
            <path d="M92.5 5.2H95.1V6.2C95.8 5.4 96.8 5 97.9 5C99.2 5 100.2 5.6 100.7 6.6C101.4 5.5 102.5 5 103.8 5C105.7 5 106.8 6.2 106.8 8.2V14.7H104.2V8.6C104.2 7.4 103.6 6.8 102.6 6.8C101.6 6.8 100.9 7.5 100.9 8.8V14.7H98.3V8.6C98.3 7.4 97.7 6.8 96.7 6.8C95.7 6.8 95.1 7.5 95.1 8.8V14.7H92.5V5.2Z" />
            {/* e */}
            <path d="M115.8 10.3H110.1C110.3 11.8 111.3 12.8 112.7 12.8C113.6 12.8 114.4 12.3 114.7 11.7H117C116.4 13.8 114.7 14.9 112.6 14.9C109.8 14.9 107.6 12.9 107.6 10C107.6 7.1 109.7 5 112.5 5C115.3 5 117.3 7.1 117.3 10.1C117.3 10.2 117.3 10.3 115.8 10.3ZM110.1 8.7H114.8C114.5 7.4 113.6 6.8 112.4 6.8C111.2 6.8 110.4 7.5 110.1 8.7Z" />
            
            {/* Interval Signature Detail: Architectural dot/notch in Iris accent */}
            <rect x="120" y="11" width="3.5" height="3.5" rx="1" fill="var(--smn-accent-iris, #8580C4)" />
          </>
        )}
      </g>
    </svg>
  );
};
