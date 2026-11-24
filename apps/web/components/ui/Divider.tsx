import React from 'react';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  spacing?: 'sm' | 'md' | 'lg';
  label?: string;
}

/**
 * SayMyName Architectural Divider (Document 10, Section 11)
 * - Clean horizontal separator using Edge #343D48
 */
export const Divider: React.FC<DividerProps> = ({
  spacing = 'md',
  label,
  className = '',
  ...props
}) => {
  const spaceMap = {
    sm: 'my-3',
    md: 'my-6',
    lg: 'my-10',
  };

  if (label) {
    return (
      <div className={`flex items-center gap-4 ${spaceMap[spacing]} ${className}`}>
        <div className="flex-1 h-[1px] bg-edge" />
        <span className="text-xs font-medium text-ash uppercase tracking-wider font-ui select-none">
          {label}
        </span>
        <div className="flex-1 h-[1px] bg-edge" />
      </div>
    );
  }

  return (
    <hr
      className={`border-0 border-t border-edge w-full ${spaceMap[spacing]} ${className}`}
      {...props}
    />
  );
};
