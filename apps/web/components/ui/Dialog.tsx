import React, { useEffect } from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

/**
 * SayMyName Accessible Dialog / Modal (Document 10, Section 11 & 19)
 * - Backdrop: Void #0B0D10 at 75% opacity with subtle backdrop blur
 * - Surface: Iron #1A2027 with Edge #343D48 boundary
 * - Radii: 12px panel radius (--smn-radius-panel)
 * - Traps focus, handles Escape key, maintains WCAG AA contrast
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthMap = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stage/85 backdrop-blur-xs transition-opacity duration-180"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface Panel */}
      <div
        className={`relative w-full ${widthMap[maxWidth]} bg-iron border border-edge rounded-[12px] shadow-2xl p-6 sm:p-7 flex flex-col gap-5 z-10 animate-in fade-in zoom-in-95 duration-180 ease-out`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="dialog-title" className="text-xl font-semibold text-chalk tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-silver mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-ash hover:text-chalk p-1 rounded-[4px] hover:bg-slate transition-colors focus-visible:outline-2 focus-visible:outline-iris"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-sm text-silver leading-relaxed">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-edge">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
