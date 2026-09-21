import React from 'react';
import { cn } from '@/utils/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex p-1 bg-stone-100 dark:bg-stone-800 rounded-2xl gap-1 border border-stone-200 dark:border-stone-700/60',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-xl transition-all duration-150',
              isActive
                ? 'bg-white dark:bg-stone-900 text-[#2d6a4f] dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-white/50 dark:hover:bg-stone-700'
            )}
          >
            {tab.icon && (
              <span className="inline-flex items-center justify-center w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                {tab.icon}
              </span>
            )}
            <span className="leading-none">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
