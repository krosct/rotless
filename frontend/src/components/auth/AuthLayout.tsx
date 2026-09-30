import React from 'react';
import { ArrowRight, Bell, Barcode, ShieldCheck, Sparkles } from 'lucide-react';

export interface AuthLayoutProps {
  children: React.ReactNode;
  /** Turns the shield into a button that opens the demo mode. */
  onDemoClick?: () => void;
  /** Shows a balloon pointing at the shield (sign-ups are closed). */
  showDemoHint?: boolean;
}

// Centre of the last column of the value props grid (3 columns, gap-3), used to
// aim the balloon arrow at the shield on any screen width.
const SHIELD_COLUMN_CENTER = 'calc((100% - 1.5rem) / 6)';

export function AuthLayout({ children, onDemoClick, showDemoHint = false }: AuthLayoutProps) {
  const hint = showDemoHint && onDemoClick !== undefined;

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-stone-50 dark:bg-stone-950 p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/rotless_logo_256.png" alt="rotless" className="w-14 h-14 object-contain mb-2" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-white">
            rot<span className="text-[#2d6a4f] dark:text-emerald-400">less</span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Despensa inteligente e alertas antes de vencer
          </p>
        </div>

        {/* Auth card container */}
        <div className="w-full bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/40 dark:shadow-none">
          {children}
        </div>

        {/* Demo hint balloon, aimed at the shield below */}
        {hint && (
          <div data-testid="demo-hint" className="relative w-full mt-6 motion-safe:animate-hint-float">
            <div className="ml-auto max-w-[17rem] rounded-2xl bg-amber-400 text-amber-950 px-4 py-3 shadow-lg shadow-amber-500/30 dark:shadow-none text-left">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <Sparkles className="w-4 h-4 shrink-0" />
                Cadastros pausados
              </p>
              <p className="mt-0.5 text-xs leading-snug">
                Novas contas estão temporariamente desativadas. Toque no escudo e explore a
                demonstração!
              </p>
            </div>
            <span
              aria-hidden="true"
              className="absolute top-full translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-10 border-t-amber-400"
              style={{ right: SHIELD_COLUMN_CENTER }}
            />
          </div>
        )}

        {/* Value props preview */}
        <div className={`${hint ? 'mt-4' : 'mt-8'} grid grid-cols-3 gap-3 w-full text-center`}>
          <div className="flex flex-col items-center text-stone-500 dark:text-stone-400">
            <Barcode className="w-4 h-4 mb-1 text-[#2d6a4f] dark:text-emerald-400" />
            <span className="text-[11px] font-medium">Leitor EAN/UPC</span>
          </div>
          <div className="flex flex-col items-center text-stone-500 dark:text-stone-400">
            <Bell className="w-4 h-4 mb-1 text-amber-500" />
            <span className="text-[11px] font-medium">Avisos Telegram</span>
          </div>
          {onDemoClick ? (
            <button
              type="button"
              data-testid="demo-shield"
              aria-label="Abrir demonstração"
              onClick={onDemoClick}
              className="group flex flex-col items-center text-stone-500 dark:text-stone-400 rounded-xl cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
            >
              <span className="relative flex mb-1">
                {hint && (
                  <span className="absolute -inset-1 rounded-full bg-emerald-400/50 motion-safe:animate-ping" />
                )}
                <ShieldCheck className="relative w-4 h-4 text-emerald-600 transition-transform group-hover:scale-110" />
              </span>
              <span className="text-[11px] font-medium">Zero Desperdício</span>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#2d6a4f] group-hover:bg-[#1b4332] dark:bg-emerald-500 dark:group-hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-semibold text-white dark:text-emerald-950 transition-colors">
                Ver demo
                <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center text-stone-500 dark:text-stone-400">
              <ShieldCheck className="w-4 h-4 mb-1 text-emerald-600" />
              <span className="text-[11px] font-medium">Zero Desperdício</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
