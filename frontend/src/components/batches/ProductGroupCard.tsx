import { ProductGroup } from '@/utils/groupBatches';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getExpiryMeta } from '@/utils/expiry';
import { formatDate, formatQuantity } from '@/utils/format';
import {
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  XCircle,
  Package,
  Barcode as BarcodeIcon,
} from 'lucide-react';

export interface ProductGroupCardProps {
  group: ProductGroup;
  onEdit?: () => void;
  onConsume?: (group: ProductGroup, action: 'consumed' | 'discarded') => void;
  onDelete?: (batchId: number) => void;
}

export function ProductGroupCard({ group, onEdit, onConsume, onDelete }: ProductGroupCardProps) {
  const expiry = getExpiryMeta(group.earliestExpiresAt);
  const hasActive = group.entries.some((entry) => entry.batch.status === 'active');

  return (
    <div
      id={`product-group-${group.productId}`}
      data-testid="product-group-card"
      className="group relative bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        {/* Top badges: Status & Total quantity */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={group.status} size="sm">
              {group.status === 'active'
                ? 'Ativo'
                : group.status === 'consumed'
                ? 'Consumido'
                : 'Descartado'}
            </Badge>

            {hasActive && (
              <Badge variant={expiry.tone} size="sm" data-testid={`expiry-badge-${expiry.tone}`}>
                {expiry.badgeText}
              </Badge>
            )}
          </div>

          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200/60 dark:border-stone-700/60">
            {formatQuantity(group.totalQuantity)}
          </span>
        </div>

        {/* Product photo & details */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200/70 dark:border-stone-700/70 overflow-hidden shrink-0 flex items-center justify-center">
            {group.product.photo_url ? (
              <img
                src={group.product.photo_url}
                alt={group.product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Package className="w-7 h-7 text-stone-400 dark:text-stone-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug line-clamp-2"
              title={group.product.name}
            >
              {group.product.name}
            </h3>

            {group.product.barcode && (
              <p className="text-[11px] text-stone-400 dark:text-stone-500 font-mono mt-0.5 flex items-center gap-1">
                <BarcodeIcon className="w-3 h-3 shrink-0" />
                {group.product.barcode}
              </p>
            )}
          </div>
        </div>

        {/* Entries list: one row per expiry date, scrollable after 3 entries */}
        <div className="flex flex-col gap-1.5 mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Entradas ({group.entries.length})
          </span>

          <div
            data-testid="product-entries-scroll"
            className="flex flex-col gap-1.5 max-h-[7.5rem] overflow-y-auto pr-0.5"
          >
            {group.entries.map((entry) => {
              const entryExpiry = getExpiryMeta(entry.expires_at);
              return (
                <div
                  key={entry.batch.id}
                  data-testid="product-entry"
                  className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-stone-50 dark:bg-stone-950/60 border border-stone-100 dark:border-stone-800/80 shrink-0"
                >
                  <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    {formatDate(entry.expires_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      {entryExpiry.label}
                    </span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {formatQuantity(entry.quantity)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1">
          {hasActive && onConsume && (
            <>
              <button
                type="button"
                onClick={() => onConsume(group, 'consumed')}
                title="Marcar como consumido"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Consumir</span>
              </button>
              <button
                type="button"
                onClick={() => onConsume(group, 'discarded')}
                title="Marcar como descartado"
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Descartar</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5 ml-auto">
          {onEdit && group.entries[0] && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              title="Editar produto"
              className="h-8 px-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="sr-only sm:not-sr-only sm:inline text-xs">Editar</span>
            </Button>
          )}

          {onDelete && group.entries[0] && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(group.entries[0].batch.id)}
              title="Excluir lote"
              className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="sr-only">Excluir</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
