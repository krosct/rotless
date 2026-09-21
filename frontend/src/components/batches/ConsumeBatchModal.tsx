import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BatchEntry } from '@/utils/groupBatches';
import { formatDate } from '@/utils/format';
import { CheckCircle2, XCircle } from 'lucide-react';

export type ConsumeAction = 'consumed' | 'discarded';

export interface ConsumeBatchModalProps {
  isOpen: boolean;
  action: ConsumeAction;
  productName: string;
  entries: BatchEntry[];
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (batchId: number, quantity: number) => void;
}

export function ConsumeBatchModal({
  isOpen,
  action,
  productName,
  entries,
  isLoading = false,
  onClose,
  onConfirm,
}: ConsumeBatchModalProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // Entries are already sorted by closest expiry; preselect the first one.
  useEffect(() => {
    if (!isOpen || entries.length === 0) return;
    const first = entries[0];
    setSelectedBatchId(first.batch.id);
    setQuantity(first.quantity);
  }, [isOpen, entries]);

  const selectedEntry = entries.find((entry) => entry.batch.id === selectedBatchId) ?? null;
  const maxQuantity = selectedEntry?.quantity ?? 1;
  const isConsume = action === 'consumed';

  const quantityError =
    !Number.isInteger(quantity) || quantity < 1
      ? 'A quantidade deve ser um número inteiro maior ou igual a 1.'
      : quantity > maxQuantity
      ? `A quantidade não pode ser maior que ${maxQuantity} un disponíveis nesta entrada.`
      : null;

  const handleSelect = (batchId: number, entryQuantity: number) => {
    setSelectedBatchId(batchId);
    setQuantity(entryQuantity);
  };

  const handleConfirm = () => {
    if (selectedBatchId === null || quantityError !== null) return;
    onConfirm(selectedBatchId, quantity);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isConsume ? 'Consumir item' : 'Descartar item'}
      description={`Selecione qual entrada de "${productName}" será ${isConsume ? 'consumida' : 'descartada'}.`}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 text-left">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide uppercase text-stone-700 dark:text-stone-300">
            Entradas disponíveis
          </span>

          <div className="flex flex-col gap-2">
            {entries.map((entry) => {
              const isSelected = entry.batch.id === selectedBatchId;
              return (
                <button
                  key={entry.batch.id}
                  type="button"
                  onClick={() => handleSelect(entry.batch.id, entry.quantity)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors ${
                    isSelected
                      ? 'border-[#2d6a4f] bg-emerald-50 dark:bg-emerald-950/40'
                      : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                        isSelected
                          ? 'border-[#2d6a4f] bg-[#2d6a4f]'
                          : 'border-stone-300 dark:border-stone-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        Validade: {formatDate(entry.expires_at)}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {entry.quantity} un disponíveis
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          type="number"
          min={1}
          max={maxQuantity}
          step={1}
          label="Quantidade"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          error={quantityError ?? undefined}
          helperText={`Máximo disponível nesta entrada: ${maxQuantity} un.`}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 dark:border-stone-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={isConsume ? 'success' : 'danger'}
            isLoading={isLoading}
            disabled={selectedBatchId === null || quantityError !== null}
            onClick={handleConfirm}
          >
            {isConsume ? (
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
            ) : (
              <XCircle className="w-4 h-4 mr-1.5" />
            )}
            {isConsume ? 'Confirmar consumo' : 'Confirmar descarte'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
