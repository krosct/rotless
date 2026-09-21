import { Leaf } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-stone-200/60 dark:border-stone-800/60 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-[#2d6a4f] dark:text-emerald-500" />
          <span className="font-semibold text-stone-700 dark:text-stone-300">rotless</span>
          <span>— Despensa Inteligente Anti-desperdício</span>
        </div>
        <p className="text-stone-400">
          Rastreie datas de validade e evite o desperdício com avisos inteligentes.
        </p>
      </div>
    </footer>
  );
}
