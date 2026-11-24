import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * SayMyName Architectural Tabs (Document 10, Section 11)
 * - STRICTLY NO capsule or pill shaped tab rails
 * - Clean rectangular buttons with subtle active indicator
 * - 44-48px accessible touch target
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center border-b border-edge gap-1 w-full overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`h-11 px-4 inline-flex items-center gap-2 text-sm font-medium transition-colors duration-120 relative select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-iris focus-visible:outline-offset-2 ${
              isActive
                ? 'text-chalk font-semibold'
                : 'text-ash hover:text-silver'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-[3px] border ${
                  isActive
                    ? 'bg-slate text-chalk border-edge'
                    : 'bg-coal text-ash border-edge/60'
                }`}
              >
                {tab.badge}
              </span>
            )}
            {/* Active architectural indicator line (Iris accent) */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-iris" />
            )}
          </button>
        );
      })}
    </div>
  );
};
