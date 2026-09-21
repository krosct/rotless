import { useState, useMemo } from 'react';
import { Batch } from '@/types';
import { ProductGroupCard } from './ProductGroupCard';
import { Button } from '@/components/ui/Button';
import { groupBatchesByProduct, ProductGroup } from '@/utils/groupBatches';
import { expiryTone } from '@/utils/expiry';
import {
  Search,
  Plus,
  PackageOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export interface BatchListProps {
  batches: Batch[];
  isLoading?: boolean;
  onAddNew: () => void;
  onEditGroup: (group: ProductGroup) => void;
  onConsume: (group: ProductGroup, action: 'consumed' | 'discarded') => void;
  onDeleteBatch: (id: number) => void;
}

type FilterStatus = 'all' | 'active' | 'soon' | 'overdue' | 'consumed';

function groupMatchesFilter(group: ProductGroup, filter: FilterStatus): boolean {
  const activeEntries = group.entries.filter((entry) => entry.batch.status === 'active');

  if (filter === 'all') return true;
  if (filter === 'consumed') return activeEntries.length === 0;

  if (activeEntries.length === 0) return false;

  if (filter === 'active') return true;

  const earliestActive = activeEntries[0].expires_at;
  const tone = expiryTone(earliestActive);
  if (filter === 'soon') return tone === 'soon';
  if (filter === 'overdue') return tone === 'overdue';

  return true;
}

export function BatchList({
  batches,
  isLoading,
  onAddNew,
  onEditGroup,
  onConsume,
  onDeleteBatch,
}: BatchListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('active');

  const groups = useMemo(() => groupBatchesByProduct(batches), [batches]);

  const counts = useMemo(() => {
    let active = 0;
    let soon = 0;
    let overdue = 0;
    let consumed = 0;

    groups.forEach((group) => {
      const activeEntries = group.entries.filter((entry) => entry.batch.status === 'active');

      if (activeEntries.length === 0) {
        consumed++;
        return;
      }

      active++;
      const tone = expiryTone(activeEntries[0].expires_at);
      if (tone === 'soon') soon++;
      if (tone === 'overdue') overdue++;
    });

    return { all: groups.length, active, soon, overdue, consumed };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const matchesSearch =
        group.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (group.product.barcode && group.product.barcode.includes(searchTerm));

      if (!matchesSearch) return false;

      return groupMatchesFilter(group, filter);
    });
  }, [groups, searchTerm, filter]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-48 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou código de barras..."
            className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'active'
                ? 'bg-[#2d6a4f] text-white shadow-xs'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50'
            }`}
          >
            Ativos ({counts.active})
          </button>

          <button
            type="button"
            onClick={() => setFilter('soon')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'soon'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-500" />
            Vencendo ({counts.soon})
          </button>

          <button
            type="button"
            onClick={() => setFilter('overdue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            Vencidos ({counts.overdue})
          </button>

          <button
            type="button"
            onClick={() => setFilter('consumed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'consumed'
                ? 'bg-stone-800 text-white dark:bg-stone-700'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-stone-400" />
            Histórico ({counts.consumed})
          </button>

          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50'
            }`}
          >
            Todos ({counts.all})
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-[#2d6a4f] dark:text-emerald-400 mb-4">
            <PackageOpen className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">
            {searchTerm
              ? 'Nenhum produto corresponde à sua busca'
              : filter === 'overdue'
              ? 'Nenhum produto vencido! 🎉'
              : filter === 'soon'
              ? 'Tudo em dia! Nenhum item vencendo em breve.'
              : 'Sua despensa está vazia'}
          </h3>

          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mb-6">
            {searchTerm
              ? 'Tente pesquisar por outro termo ou limpe o campo de busca.'
              : 'Comece adicionando alimentos escaneando o código de barras ou cadastrando manualmente.'}
          </p>

          <Button variant="primary" onClick={onAddNew} size="md">
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar primeiro lote
          </Button>
        </div>
      ) : (
        /* Product Groups Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredGroups.map((group) => (
            <ProductGroupCard
              key={group.productId}
              group={group}
              onEdit={() => onEditGroup(group)}
              onConsume={onConsume}
              onDelete={onDeleteBatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
