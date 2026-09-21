import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ProductGroup, BatchEntry } from '@/utils/groupBatches';
import { BatchStatus } from '@/types';
import { formatDate, formatQuantity } from '@/utils/format';
import {
  Camera,
  CheckCircle2,
  XCircle,
  Upload,
  X,
  ChevronLeft,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ProductEditModalProps {
  isOpen: boolean;
  group: ProductGroup | null;
  isLoading?: boolean;
  onClose: () => void;
  onSaveProduct: (input: { name: string; photo: File | null }) => Promise<void>;
  onSaveEntry: (
    batchId: number,
    input: { quantity: number; expires_at: string; status: BatchStatus }
  ) => Promise<void>;
  onConsumeAll: (action: 'consumed' | 'discarded') => Promise<void>;
}

export function ProductEditModal({
  isOpen,
  group,
  isLoading = false,
  onClose,
  onSaveProduct,
  onSaveEntry,
  onConsumeAll,
}: ProductEditModalProps) {
  const [name, setName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [entryQuantity, setEntryQuantity] = useState(1);
  const [entryExpiresAt, setEntryExpiresAt] = useState('');
  const [entryStatus, setEntryStatus] = useState<BatchStatus>('active');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productId = group?.productId ?? null;

  // Reset the form only when the modal opens or switches to another product,
  // so live data updates do not wipe what the user is typing.
  useEffect(() => {
    if (!isOpen || !group) return;
    setName(group.product.name);
    setPhotoFile(null);
    setPhotoPreview(group.product.photo_url ?? null);
    setSelectedBatchId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, productId]);

  // Keep the selected entry in sync with fresh data after a save.
  const selectedEntry = useMemo(
    () => group?.entries.find((entry) => entry.batch.id === selectedBatchId) ?? null,
    [group, selectedBatchId]
  );

  const handlePhotoSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSelectEntry = (entry: BatchEntry) => {
    setSelectedBatchId(entry.batch.id);
    setEntryQuantity(entry.quantity);
    setEntryExpiresAt(entry.expires_at);
    setEntryStatus(entry.batch.status);
  };

  const handleSaveProduct = async () => {
    if (name.trim().length < 2) {
      toast.error('O nome do produto deve ter pelo menos 2 caracteres.');
      return;
    }
    await onSaveProduct({ name: name.trim(), photo: photoFile });
  };

  const handleSaveEntry = async () => {
    if (selectedBatchId === null) return;
    await onSaveEntry(selectedBatchId, {
      quantity: entryQuantity,
      expires_at: entryExpiresAt,
      status: entryStatus,
    });
    setSelectedBatchId(null);
  };

  if (!group) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedEntry ? 'Editar entrada' : 'Editar produto'}
      description={
        selectedEntry
          ? `Ajuste quantidade, validade ou status da entrada de ${formatDate(selectedEntry.expires_at)}.`
          : `Gerencie "${group.product.name}" e suas ${group.entries.length} entradas.`
      }
      maxWidth="lg"
    >
      {selectedEntry ? (
        /* Entry editing view */
        <div className="flex flex-col gap-4 text-left">
          <button
            type="button"
            onClick={() => setSelectedBatchId(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 self-start"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Voltar para o produto
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              min={1}
              step={1}
              label="Quantidade"
              value={entryQuantity}
              onChange={(e) => setEntryQuantity(Number(e.target.value))}
            />

            <Input
              type="date"
              label="Data de validade"
              value={entryExpiresAt}
              onChange={(e) => setEntryExpiresAt(e.target.value)}
            />
          </div>

          <Select
            label="Status do lote"
            value={entryStatus}
            onChange={(e) => setEntryStatus(e.target.value as BatchStatus)}
            options={[
              { value: 'active', label: 'Ativo (na despensa)' },
              { value: 'consumed', label: 'Consumido' },
              { value: 'discarded', label: 'Descartado' },
            ]}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 dark:border-stone-800">
            <Button type="button" variant="secondary" onClick={() => setSelectedBatchId(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" isLoading={isLoading} onClick={handleSaveEntry}>
              Salvar entrada
            </Button>
          </div>
        </div>
      ) : (
        /* Product editing view */
        <div className="flex flex-col gap-5 text-left">
          <Input
            label="Nome do produto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Photo upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wide uppercase text-stone-700 dark:text-stone-300">
              Foto do produto <span className="text-stone-400 font-normal lowercase">(opcional, máx 5MB)</span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-[#2d6a4f] dark:hover:border-emerald-500 rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-colors bg-stone-50/50 dark:bg-stone-950/30"
            >
              {photoPreview ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white dark:bg-stone-800 border border-stone-200 shrink-0">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute top-1 right-1 bg-stone-900/80 text-white rounded-full p-0.5 hover:bg-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-stone-200/80 dark:bg-stone-800 flex items-center justify-center text-stone-500 shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
              )}

              <div className="flex-1 text-xs text-stone-600 dark:text-stone-400">
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  Clique para carregar
                </span>{' '}
                uma nova foto.
                <p className="text-[11px] text-stone-400 mt-0.5">PNG, JPG ou WEBP até 5MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePhotoSelect(e.target.files[0]);
                  }
                }}
              />
            </div>
          </div>

          <Button type="button" variant="primary" isLoading={isLoading} onClick={handleSaveProduct}>
            <Camera className="w-4 h-4 mr-1.5" />
            Salvar produto
          </Button>

          {/* Bulk actions */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/40 border border-stone-200/80 dark:border-stone-800">
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Ações em todas as entradas
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="success"
                size="sm"
                isLoading={isLoading}
                onClick={() => onConsumeAll('consumed')}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Consumir tudo
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isLoading}
                onClick={() => onConsumeAll('discarded')}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Descartar tudo
              </Button>
            </div>
          </div>

          {/* Entries list */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide uppercase text-stone-700 dark:text-stone-300">
              Entradas ({group.entries.length})
            </span>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-0.5">
              {group.entries.map((entry) => (
                <button
                  key={entry.batch.id}
                  type="button"
                  onClick={() => handleSelectEntry(entry)}
                  data-testid="edit-entry-row"
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {formatDate(entry.expires_at)}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {formatQuantity(entry.quantity)} &bull;{' '}
                        {entry.batch.status === 'active'
                          ? 'Ativo'
                          : entry.batch.status === 'consumed'
                          ? 'Consumido'
                          : 'Descartado'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#2d6a4f] dark:text-emerald-400 shrink-0">
                    Editar
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-stone-100 dark:border-stone-800">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
