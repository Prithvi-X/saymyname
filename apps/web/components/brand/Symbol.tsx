import React from 'react';

export interface SymbolProps extends React.SVGProps<SVGSVGElement> {
  concept?: 'A' | 'B' | 'C';
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  accentColor?: string;
}

/**
 * SayMyName Brand Symbol - THE INTERVAL (Document 10, Section 06)
 *
 * Three distinct architectural directions built around:
 * "Two identities. One moment of recognition."
 *
 * Concept A (Paired Interval):
 * Two independent solid masses separated by a deliberate negative space (the interval).
 * The tension between the forms forms an implied pathway / moment of alignment.
 *
 * Concept B (Subtractive Architectural Cut):
 * A monolithic form cleaved cleanly by an angled precision cut, revealing the interval
 * as an intentional structural void.
 *
 * Concept C (Facet Convergence):
 * Symmetrical multi-facet elements converging towards a shared aperture without touching,
 * communicating individuality within mutuality.
 */
export const Symbol: React.FC<SymbolProps> = ({
  concept = 'A',
  size = 'md',
  color = 'var(--smn-text-primary, #F0F1EE)',
  accentColor = 'var(--smn-accent-iris, #8580C4)',
  className = '',
  ...props
}) => {
  const sizeMap: Record<string, number> = {
    sm: 24,
    md: 36,
    lg: 48,
    xl: 64,
  };

  const dim = typeof size === 'number' ? size : sizeMap[size] || 36;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`SayMyName Symbol (Concept ${concept})`}
      role="img"
      {...props}
    >
      <title>{`SayMyName Interval Mark - Concept ${concept}`}</title>

      {concept === 'A' && (
        /* Concept A: Paired Masses with Central Interval */
        <g id="interval-concept-a">
          {/* Identity Form 1: Left architectural mass */}
          <path
            d="M8 8H20C21.6569 8 23 9.34315 23 11V37C23 38.6569 21.6569 40 20 40H8V8Z"
            fill={color}
          />
          {/* Internal notch expressing individuality */}
          <path
            d="M14 16H23V24H14V16Z"
            fill="var(--smn-stage, #0B0D10)"
          />

          {/* Central Interval: The 4px void between masses (x: 23-27) */}

          {/* Identity Form 2: Right architectural mass */}
          <path
            d="M27 8H39C40.6569 8 42 9.34315 42 11V37C42 38.6569 40.6569 40 39 40H27V8Z"
            fill={color}
          />
          {/* Offset internal notch creating mutual recognition */}
          <path
            d="M27 24H36V32H27V24Z"
            fill="var(--smn-stage, #0B0D10)"
          />

          {/* Signal Indicator: Single Iris anchor point in the interval */}
          <rect
            x="22.5"
            y="22.5"
            width="3"
            height="3"
            rx="0.75"
            fill={accentColor}
          />
        </g>
      )}

      {concept === 'B' && (
        /* Concept B: Monolithic Form with Precision Subtractive Cut */
        <g id="interval-concept-b">
          {/* Upper Identity Plane: Cut along diagonal vector */}
          <path
            d="M8 10C8 8.89543 8.89543 8 10 8H38C39.1046 8 40 8.89543 40 10V18L18 30L8 24V10Z"
            fill={color}
          />

          {/* The Subtractive Cut Void (The Interval): 3.5px angled separation */}

          {/* Lower Identity Plane: Mirrored offset plane */}
          <path
            d="M8 28.5L28 17.5L40 24V38C40 39.1046 39.1046 40 38 40H10C8.89543 40 8 39.1046 8 38V28.5Z"
            fill={color}
          />

          {/* Signal Accent: Tension facet at cut apex */}
          <polygon
            points="26,19 30,17 32,21 28,23"
            fill={accentColor}
          />
        </g>
      )}

      {concept === 'C' && (
        /* Concept C: Facet Convergence into Symmetrical Silhouette */
        <g id="interval-concept-c">
          {/* Top-Left Quadrant Facet */}
          <path
            d="M10 10H22V22H14C11.7909 22 10 20.2091 10 18V10Z"
            fill={color}
          />
          {/* Top-Right Quadrant Facet */}
          <path
            d="M26 10H38V18C38 20.2091 36.2091 22 34 22H26V10Z"
            fill={color}
          />
          {/* Bottom-Left Quadrant Facet */}
          <path
            d="M10 26H18C20.2091 26 22 27.7909 22 30V38H10V26Z"
            fill={color}
          />
          {/* Bottom-Right Quadrant Facet */}
          <path
            d="M26 26H34C36.2091 26 38 27.7909 38 30V38H26V26Z"
            fill={color}
          />

          {/* Central Interval Aperture: 4px cross void revealing Iris signal */}
          <rect
            x="21.5"
            y="21.5"
            width="5"
            height="5"
            rx="1"
            fill={accentColor}
          />
        </g>
      )}
    </svg>
  );
};
