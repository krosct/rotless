import { Batch, BatchStatus } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/utils/format';
import { Package } from 'lucide-react';

export interface BatchHistoryTableProps {
  batches: Batch[];
}

const statusLabels: Record<BatchStatus, string> = {
  active: 'Ativo',
  consumed: 'Consumido',
  discarded: 'Descartado',
};

export function BatchHistoryTable({ batches }: BatchHistoryTableProps) {
  if (batches.length === 0) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-400 mb-4">
          <Package className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">
          Nenhuma operação registrada
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm">
          As operações da despensa aparecerão aqui conforme os lotes forem criados, consumidos ou
          descartados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="batch-history-table">
          <thead className="bg-stone-50 dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800">
            <tr className="text-[11px] uppercase tracking-wide text-stone-500 dark:text-stone-400">
              <th className="px-4 py-3 font-semibold">Produto</th>
              <th className="px-4 py-3 font-semibold">Qtd</th>
              <th className="px-4 py-3 font-semibold">Validade</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Criado por</th>
              <th className="px-4 py-3 font-semibold">Criado em</th>
              <th className="px-4 py-3 font-semibold">Atualizado por</th>
              <th className="px-4 py-3 font-semibold">Atualizado em</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {batches.map((batch) => (
              <tr
                key={batch.id}
                data-testid="history-row"
                className="hover:bg-stone-50/60 dark:hover:bg-stone-800/60 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-stone-900 dark:text-stone-100">
                    {batch.product.name}
                  </span>
                  {batch.product.barcode && (
                    <span className="block text-[11px] font-mono text-stone-400 dark:text-stone-500">
                      {batch.product.barcode}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-700 dark:text-stone-300">{batch.quantity}</td>
                <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                  {formatDate(batch.expires_at)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={batch.status} size="sm">
                    {statusLabels[batch.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                  {batch.created_by?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-stone-500 dark:text-stone-400 whitespace-nowrap">
                  {batch.created_at ? formatDate(batch.created_at, 'dd/MM/yyyy HH:mm') : '—'}
                </td>
                <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                  {batch.updated_by?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-stone-500 dark:text-stone-400 whitespace-nowrap">
                  {batch.updated_at ? formatDate(batch.updated_at, 'dd/MM/yyyy HH:mm') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
