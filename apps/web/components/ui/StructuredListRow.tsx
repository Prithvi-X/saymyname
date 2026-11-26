import React from 'react';

export interface StructuredListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  muted?: boolean;
  media?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  testId?: string;
}

/**
 * StructuredListRow (Milestone 1 — THE INTERVAL)
 * Clean horizontal row for Likes, Matches, and member directories.
 * Uses solid Coal/Iron/Slate hierarchy and hairline Edge borders without nested cards
 * or prohibited left vertical accent rails.
 */
export const StructuredListRow: React.FC<StructuredListRowProps> = ({
  selected = false,
  muted = false,
  media,
  children,
  actions,
  testId,
  className = '',
  ...props
}) => {
  return (
    <div
      data-testid={testId}
      className={`px-4 py-4 sm:px-5 sm:py-4.5 border-b border-edge last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-120 ${
        muted
          ? 'bg-stage/80 opacity-75'
          : selected
            ? 'bg-slate'
            : 'bg-coal hover:bg-iron'
      } ${className}`}
      {...props}
    >
      <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
        {media && <div className="shrink-0">{media}</div>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};
