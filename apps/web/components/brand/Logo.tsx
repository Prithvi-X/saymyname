import React from 'react';
import Link from 'next/link';
import { Symbol } from './Symbol';
import { Wordmark } from './Wordmark';

export interface LogoProps {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  showSymbol?: boolean;
  showWordmark?: boolean;
  symbolConcept?: 'A' | 'B' | 'C';
  className?: string;
}

/**
 * SayMyName Brand Lockup (Document 10)
 * Combines the Interval Symbol and Grotesk Wordmark with calibrated optical spacing.
 */
export const Logo: React.FC<LogoProps> = ({
  href = '/',
  size = 'md',
  showSymbol = true,
  showWordmark = true,
  symbolConcept = 'A',
  className = '',
}) => {
  const content = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {showSymbol && (
        <Symbol
          concept={symbolConcept}
          size={size === 'sm' ? 24 : size === 'lg' ? 38 : 30}
          className="transition-transform duration-180 ease-out group-hover:scale-105"
        />
      )}
      {showWordmark && (
        <Wordmark
          size={size}
          className="text-chalk transition-opacity duration-180 group-hover:opacity-90"
        />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-iris focus-visible:outline-offset-4 rounded-tight">
        {content}
      </Link>
    );
  }

  return content;
};

export * from './Wordmark';
export * from './Symbol';
