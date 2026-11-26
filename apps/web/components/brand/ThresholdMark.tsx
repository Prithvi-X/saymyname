import React from 'react';

export interface ThresholdMarkProps {
  /**
   * 'aligned' renders the two stepped architectural forms settled at the threshold
   * with the third warm Ember signal square active in the deliberate center gap.
   * 'separated' widens the gap with the center signal muted/absent (for calm empty/awaiting states).
   */
  variant?: 'aligned' | 'separated';
  /** Enables the brief one-time 320ms Document 10 signature convergence animation (honors prefers-reduced-motion). */
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * ThresholdMark (Proposed Document 10 Extension — DEC-UI-01)
 * Architectural twin stepped forms (Gujarat stepwell / antarāla proportion) facing across
 * a calibrated central gap. On mutual alignment, a single 8px Ember square appears between them.
 */
export const ThresholdMark: React.FC<ThresholdMarkProps> = ({
  variant = 'aligned',
  animate = false,
  size = 'md',
  className = '',
}) => {
  const scaleMap = {
    sm: { w: 88, h: 64 },
    md: { w: 128, h: 96 },
    lg: { w: 164, h: 120 },
  };
  const { w, h } = scaleMap[size];
  const isAligned = variant === 'aligned';

  // Coordinated viewBox 0..128 x 0..96
  const leftClass = animate && isAligned ? 'smn-threshold-left' : '';
  const rightClass = animate && isAligned ? 'smn-threshold-right' : '';
  const signalClass = animate && isAligned ? 'smn-threshold-signal' : '';

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 128 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Left stepped architectural form */}
      <g className={leftClass}>
        <path
          d={
            isAligned
              ? 'M12 10C12 7.79086 13.7909 6 16 6H52V28H34V68H52V90H16C13.7909 90 12 88.2091 12 86V10Z'
              : 'M6 10C6 7.79086 7.79086 6 10 6H44V28H26V68H44V90H10C7.79086 90 6 88.2091 6 86V10Z'
          }
          fill="#1A2027"
          stroke={isAligned ? '#465261' : '#343D48'}
          strokeWidth="1.5"
        />
        {/* Inner Iris step detail */}
        <rect
          x={isAligned ? 34 : 26}
          y="34"
          width="6"
          height="28"
          rx="1"
          fill="#8580C4"
          fillOpacity={isAligned ? '0.45' : '0.25'}
        />
      </g>

      {/* Center Interval Signal Square */}
      {isAligned ? (
        <rect
          x="59"
          y="43"
          width="10"
          height="10"
          rx="2"
          fill="#E18A62"
          className={signalClass}
        />
      ) : (
        <rect
          x="60"
          y="44"
          width="8"
          height="8"
          rx="1.5"
          stroke="#343D48"
          strokeWidth="1.5"
          fill="#12161B"
        />
      )}

      {/* Right mirrored stepped architectural form */}
      <g className={rightClass}>
        <path
          d={
            isAligned
              ? 'M116 10C116 7.79086 114.209 6 112 6H76V28H94V68H76V90H112C114.209 90 116 88.2091 116 86V10Z'
              : 'M122 10C122 7.79086 120.209 6 118 6H84V28H102V68H84V90H118C120.209 90 122 88.2091 122 86V10Z'
          }
          fill="#1A2027"
          stroke={isAligned ? '#465261' : '#343D48'}
          strokeWidth="1.5"
        />
        {/* Inner Chalk step detail */}
        <rect
          x={isAligned ? 88 : 96}
          y="34"
          width="6"
          height="28"
          rx="1"
          fill="#F0F1EE"
          fillOpacity={isAligned ? '0.28' : '0.14'}
        />
      </g>
    </svg>
  );
};
