import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Household } from '@/types';
import { ChevronDown, Home, Users, Check } from 'lucide-react';

export function HouseholdSwitcher() {
  const { user, currentHousehold, setCurrentHousehold } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const households = user?.households ?? [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentHousehold || households.length === 0) return null;

  const isOwn = (household: Household) =>
    household.is_owner === true || household.role === 'owner';

  const handleSelect = (household: Household) => {
    setCurrentHousehold(household);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center gap-2 pl-3 border-l border-stone-200 dark:border-stone-800 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] rounded-xl"
      >
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#2d6a4f] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 truncate max-w-[200px]">
          {currentHousehold.name}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl overflow-hidden z-40"
        >
          {households.map((household) => {
            const own = isOwn(household);
            const isCurrent = household.id === currentHousehold.id;

            return (
              <button
                key={household.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => handleSelect(household)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                <span className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
                  {own ? <Home className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                    {household.name}
                  </span>
                  <span className="block text-[11px] text-stone-500 dark:text-stone-400">
                    {own ? 'Sua despensa' : 'Convidado'}
                  </span>
                </span>

                {isCurrent && <Check className="w-4 h-4 text-[#2d6a4f] dark:text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
