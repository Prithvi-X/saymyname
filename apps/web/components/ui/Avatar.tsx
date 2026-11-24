import React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  verified?: boolean;
}

/**
 * SayMyName Avatar & Profile Frame (Document 10, Section 11 & 13)
 * - Rectangular framing with 8px radius (--smn-radius-control)
 * - Zero circular floating bubbles or neon halo borders
 * - Subtle Edge border and Coal backdrop
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Member avatar',
  name,
  size = 'md',
  verified = false,
  className = '',
  ...props
}) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs rounded-[4px]',
    md: 'w-11 h-11 text-sm rounded-[6px]',
    lg: 'w-16 h-16 text-lg rounded-[8px]',
    xl: 'w-24 h-24 text-2xl rounded-[10px]',
  };

  // Generate clean initials if no photo
  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className={`relative inline-block shrink-0 ${className}`} {...props}>
      <div
        className={`relative overflow-hidden bg-iron border border-edge flex items-center justify-center font-semibold text-silver select-none ${sizeMap[size]}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {verified && (
        <span
          title="Verified Member"
          className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#10241A] border border-success/60 rounded-[3px] flex items-center justify-center text-success"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </div>
  );
};
