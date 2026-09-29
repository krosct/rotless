export function Footer() {
  return (
    <footer className="w-full border-t border-stone-200/60 dark:border-stone-800/60 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/rotless_logo_64.png" alt="" className="w-4 h-4 object-contain" />
          <span className="font-semibold text-stone-700 dark:text-stone-300">rotless</span>
          <span>— Despensa Inteligente Anti-desperdício</span>
        </div>
        <div className="flex flex-col items-center sm:items-end gap-1">
          <p className="text-stone-400">
            Rastreie datas de validade e evite o desperdício com avisos inteligentes.
          </p>
          <p className="text-stone-400/80 font-mono text-[11px]" title="Versão do site">
            {__APP_VERSION__}
          </p>
        </div>
      </div>
    </footer>
  );
}
