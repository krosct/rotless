import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Household } from '@/types';
import { ChevronDown, Home, Users, Check, Settings } from 'lucide-react';

export function HouseholdSwitcher() {
  const { user, currentHousehold, setCurrentHousehold } = useAuth();
  const navigate = useNavigate();
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

  const handleOpenSettings = (household: Household) => {
    setIsOpen(false);
    navigate(`/households/${household.id}/settings`);
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="group flex items-center gap-2 pl-3 border-l border-stone-200 dark:border-stone-800 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] rounded-xl"
      >
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#2d6a4f] dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 truncate max-w-[200px] transition-all duration-150 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 group-hover:border-emerald-300 dark:group-hover:border-emerald-700 group-hover:shadow-xs">
          {currentHousehold.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'
          }`}
        />
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
              <div
                key={household.id}
                className="group/item flex items-center hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => handleSelect(household)}
                  className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-all duration-150 group-hover/item:pl-4"
                >
                  <span className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0 transition-colors duration-150 group-hover/item:bg-emerald-50 dark:group-hover/item:bg-emerald-950/60 group-hover/item:text-[#2d6a4f] dark:group-hover/item:text-emerald-400">
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

                {own && (
                  <button
                    type="button"
                    onClick={() => handleOpenSettings(household)}
                    title="Configurações da despensa"
                    aria-label={`Configurações de ${household.name}`}
                    className="mr-2 p-1.5 rounded-lg text-stone-400 hover:text-[#2d6a4f] dark:hover:text-emerald-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors shrink-0"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
