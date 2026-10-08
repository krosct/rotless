import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import {
  LogOut,
  Moon,
  Sun,
  Home,
  Plus,
  User as UserIcon,
} from 'lucide-react';

export interface HeaderProps {
  onOpenNewBatchModal?: () => void;
}

export function Header({ onOpenNewBatchModal }: HeaderProps) {
  const { user, logout, theme, toggleTheme, isDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Household */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] rounded-xl p-1"
          >
            <img
              src="/rotless_logo_128.png"
              alt=""
              className="w-9 h-9 object-contain group-hover:scale-105 transition-transform"
            />
            <span className="hidden sm:inline font-bold text-xl tracking-tight text-stone-900 dark:text-white">
              rot<span className="text-[#2d6a4f] dark:text-emerald-400">less</span>
            </span>
          </Link>

          <HouseholdSwitcher />
        </div>

        {/* Right navigation actions */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {/* Quick Add Batch Button on Desktop Header */}
          {onOpenNewBatchModal && (
            <Button
              size="sm"
              variant="primary"
              onClick={onOpenNewBatchModal}
              className="hidden md:inline-flex"
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Lote
            </Button>
          )}

          {/* Navigation links */}
          <Link
            to="/dashboard"
            className={`p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors ${
              location.pathname === '/dashboard' ? 'bg-stone-100 dark:bg-stone-800 text-[#2d6a4f] dark:text-emerald-400' : ''
            }`}
            title="Dashboard"
          >
            <Home className="w-5 h-5" />
            <span className="sr-only">Dashboard</span>
          </Link>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar modo escuro"
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* User info & Logout */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-stone-200 dark:border-stone-800">
            {user && (
              <Link
                to="/settings"
                title="Configurações da conta"
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-colors ${
                  location.pathname === '/settings'
                    ? 'bg-stone-100 dark:bg-stone-800 text-[#2d6a4f] dark:text-emerald-400'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <UserIcon className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline text-xs font-medium truncate max-w-[120px]">
                  {user.name.split(' ')[0]}
                </span>
                <span className="sr-only">Configurações da conta</span>
              </Link>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              className="text-stone-600 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 px-2 sm:px-3"
            >
              <LogOut className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-xs font-semibold">Sair</span>
            </Button>
          </div>
        </div>
      </div>
      {isDemo && (
        <div className="border-t border-amber-200/70 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-between gap-3 text-xs">
            <span>
              <strong className="font-semibold">Modo demonstração</strong> — dados fictícios; tudo o que você fizer
              aqui é descartado ao sair.
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
            >
              Sair da demonstração
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
