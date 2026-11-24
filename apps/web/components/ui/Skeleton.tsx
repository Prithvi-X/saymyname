import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'tight' | 'control' | 'panel';
}

/**
 * SayMyName Architectural Skeleton Loader (Document 10, Section 11 & 19)
 * - Subtle shimmer against Coal/Iron surfaces
 * - Zero exaggerated purple/cyan glow or extreme pulsation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  rounded = 'tight',
  className = '',
  style,
  ...props
}) => {
  const roundMap = {
    none: 'rounded-none',
    tight: 'rounded-[4px]',
    control: 'rounded-[8px]',
    panel: 'rounded-[12px]',
  };

  return (
    <div
      className={`bg-iron/80 animate-pulse ${roundMap[rounded]} ${className}`}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
};
