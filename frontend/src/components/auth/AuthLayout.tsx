import React, { useRef } from 'react';
import { Leaf, Bell, Barcode, ShieldCheck } from 'lucide-react';

export interface AuthLayoutProps {
  children: React.ReactNode;
  /** Hidden shortcut: three quick taps on the shield icon (the demo mode). */
  onShieldTripleTap?: () => void;
}

const TAP_WINDOW_MS = 700;

export function AuthLayout({ children, onShieldTripleTap }: AuthLayoutProps) {
  // Counted by hand instead of MouseEvent.detail, which touch screens do not
  // report reliably.
  const taps = useRef<number[]>([]);

  const handleShieldTap = () => {
    if (!onShieldTripleTap) return;
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < TAP_WINDOW_MS * 2), now];
    const [first] = taps.current.slice(-3);
    if (taps.current.length >= 3 && now - first < TAP_WINDOW_MS * 2) {
      taps.current = [];
      onShieldTripleTap();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-stone-50 dark:bg-stone-950 p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#2d6a4f] text-white flex items-center justify-center shadow-md mb-3">
            <Leaf className="w-7 h-7 text-emerald-200" />
          </div>
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

        {/* Value props preview */}
        <div className="mt-8 grid grid-cols-3 gap-3 w-full text-center">
          <div className="flex flex-col items-center text-stone-500 dark:text-stone-400">
            <Barcode className="w-4 h-4 mb-1 text-[#2d6a4f] dark:text-emerald-400" />
            <span className="text-[11px] font-medium">Leitor EAN/UPC</span>
          </div>
          <div className="flex flex-col items-center text-stone-500 dark:text-stone-400">
            <Bell className="w-4 h-4 mb-1 text-amber-500" />
            <span className="text-[11px] font-medium">Avisos Telegram</span>
          </div>
          <div className="flex flex-col items-center text-stone-500 dark:text-stone-400 select-none">
            <ShieldCheck
              data-testid="demo-shield"
              onClick={handleShieldTap}
              className="w-4 h-4 mb-1 text-emerald-600"
            />
            <span className="text-[11px] font-medium">Zero Desperdício</span>
          </div>
        </div>
      </div>
    </div>
  );
}
