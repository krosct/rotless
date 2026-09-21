import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Batch, BatchStatus } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { getTodayISODate } from '@/utils/format';
import { lookupBarcode } from '@/api/batches';
import {
  Camera,
  Barcode as BarcodeIcon,
  FileText,
  Upload,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const today = getTodayISODate();

// Validation schema for creating or editing batch
const batchSchema = z
  .object({
    mode: z.enum(['barcode', 'manual']),
    household_id: z.number().optional(),
    barcode: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number().min(1, 'A quantidade mínima é 1'),
    expires_at: z.string().min(1, 'A data de validade é obrigatória').refine(
      (val) => !val || val >= today,
      'A data de validade não pode ser anterior a hoje'
    ),
    status: z.enum(['active', 'consumed', 'discarded']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'barcode' && !data.barcode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['barcode'],
        message: 'Escaneie ou digite o código de barras',
      });
    }
    if (data.mode === 'manual' && (!data.name || data.name.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'O nome do produto deve ter pelo menos 2 caracteres',
      });
    }
  });

type BatchFormData = z.infer<typeof batchSchema>;

export interface BatchFormProps {
  initialBatch?: Batch | null;
  householdId?: number;
  onSubmit: (formData: {
    household_id?: number;
    barcode?: string;
    name?: string;
    quantity: number;
    expires_at: string;
    status?: BatchStatus;
    photo?: File | null;
  }) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function BatchForm({
  initialBatch,
  householdId,
  onSubmit,
  onCancel,
  isLoading = false,
}: BatchFormProps) {
  const isEditing = !!initialBatch;
  const initialMode = initialBatch ? (initialBatch.product.barcode ? 'barcode' : 'manual') : 'barcode';
  const [activeTab, setActiveTab] = useState<'barcode' | 'manual'>(initialMode);
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [barcodePreviewName, setBarcodePreviewName] = useState<string | null>(
    initialBatch?.product.name || null
  );
  const [barcodeLookupError, setBarcodeLookupError] = useState<string | null>(null);

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialBatch?.product.photo_url || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      mode: initialMode,
      household_id: householdId || initialBatch?.household_id,
      barcode: initialBatch?.product.barcode || '',
      name: initialBatch?.product.name || '',
      quantity: initialBatch?.quantity || 1,
      expires_at: initialBatch?.expires_at || '',
      status: initialBatch?.status || 'active',
    },
  });

  const barcodeValue = watch('barcode');

  const handleTabChange = (tabId: string) => {
    const mode = tabId as 'barcode' | 'manual';
    setActiveTab(mode);
    setValue('mode', mode);
    setBarcodeLookupError(null);
  };

  const handleBarcodeResolved = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setBarcodeLookupError('Informe um código de barras para buscar.');
      return;
    }

    setValue('barcode', trimmed);
    setIsScanning(false);
    setIsLookingUpBarcode(true);
    setBarcodeLookupError(null);

    try {
      const res = await lookupBarcode(trimmed);
      if (res.name) {
        setBarcodePreviewName(res.name);
        setValue('name', res.name);
        if (res.photo_url && !photoPreview) {
          setPhotoPreview(res.photo_url);
        }
        toast.success(`Produto identificado: "${res.name}"`);
      } else {
        setBarcodePreviewName(null);
        setBarcodeLookupError(
          'Produto não encontrado no OpenFoodFacts. Use a aba "Manual" para cadastrá-lo.'
        );
        toast.warning('Código não encontrado. Cadastre o produto manualmente.');
      }
    } catch {
      setBarcodePreviewName(null);
      setBarcodeLookupError('Não foi possível consultar o código agora. Tente novamente.');
      toast.error('Falha ao buscar o código de barras.');
    } finally {
      setIsLookingUpBarcode(false);
    }
  };

  const handlePhotoSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoSelect(e.dataTransfer.files[0]);
    }
  };

  const onFormSubmit = async (data: BatchFormData) => {
    try {
      await onSubmit({
        household_id: householdId || data.household_id,
        barcode: data.mode === 'barcode' ? data.barcode : undefined,
        name: data.mode === 'manual' ? data.name : barcodePreviewName || data.name || undefined,
        quantity: data.quantity,
        expires_at: data.expires_at,
        status: data.status,
        photo: photoFile,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const apiErrors = (err as { errors: Record<string, string[]> }).errors;
        Object.entries(apiErrors).forEach(([field, msgs]) => {
          setError(field as keyof BatchFormData, {
            type: 'server',
            message: msgs[0],
          });
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-5 text-left">
      {/* Scanner overlay if active */}
      {isScanning && (
        <div className="mb-2 p-4 bg-stone-50 dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Leitor de Código de Barras
            </span>
            <button
              type="button"
              onClick={() => setIsScanning(false)}
              className="text-stone-400 hover:text-stone-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <BarcodeScanner
            onScanSuccess={handleBarcodeResolved}
            onClose={() => setIsScanning(false)}
          />
        </div>
      )}

      {/* Mode selection tabs (only when creating new batch) */}
      {!isEditing && (
        <Tabs
          tabs={[
            { id: 'barcode', label: 'Código de barras', icon: <BarcodeIcon /> },
            { id: 'manual', label: 'Manual', icon: <FileText /> },
          ]}
          activeTab={activeTab}
          onChange={handleTabChange}
        />
      )}

      {/* Tab 1: Barcode Input */}
      {activeTab === 'barcode' && !isEditing && (
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Código de barras"
                placeholder="Ex: 7891000100103"
                {...register('barcode')}
                error={errors.barcode?.message}
                rightElement={
                  barcodeValue && (
                    <button
                      type="button"
                      onClick={() => handleBarcodeResolved(barcodeValue)}
                      title="Buscar no OpenFoodFacts"
                      className="text-xs text-[#2d6a4f] dark:text-emerald-400 font-medium px-2 py-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      {isLookingUpBarcode ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Buscar'
                      )}
                    </button>
                  )
                }
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsScanning(true)}
              className="shrink-0 h-10 px-3.5 border-[#2d6a4f]/30 text-[#2d6a4f] dark:text-emerald-400 hover:bg-[#2d6a4f]/10"
            >
              <Camera className="w-4 h-4 mr-1.5" />
              Escanear
            </Button>
          </div>

          {/* Barcode preview banner if found */}
          {barcodePreviewName && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="text-emerald-800 dark:text-emerald-200 font-medium">
                  Produto identificado:{' '}
                </span>
                <span className="text-stone-900 dark:text-stone-100 font-bold">
                  {barcodePreviewName}
                </span>
              </div>
            </div>
          )}

          {/* Barcode lookup error banner */}
          {barcodeLookupError && (
            <div
              role="alert"
              className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span className="text-xs text-amber-800 dark:text-amber-200">
                {barcodeLookupError}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manual Name & Photo */}
      {(activeTab === 'manual' || isEditing) && (
        <div className="flex flex-col gap-4">
          <Input
            label="Nome do produto"
            placeholder="Ex: Leite Integral, Iogurte, Arroz..."
            required
            {...register('name')}
            error={errors.name?.message}
          />

          {/* Photo upload dropzone (optional, <= 5MB) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wide uppercase text-stone-700 dark:text-stone-300">
              Foto do produto <span className="text-stone-400 font-normal lowercase">(opcional, máx 5MB)</span>
            </label>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
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
                ou arraste uma foto aqui.
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
        </div>
      )}

      {/* Common fields: Quantity & Expiration Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          type="number"
          min={1}
          step={1}
          label="Quantidade"
          required
          {...register('quantity', { valueAsNumber: true })}
          error={errors.quantity?.message}
        />

        <Input
          type="date"
          min={isEditing ? undefined : today}
          label="Data de validade"
          required
          {...register('expires_at')}
          error={errors.expires_at?.message}
        />
      </div>

      {/* Status (when editing) */}
      {isEditing && (
        <Select
          label="Status do lote"
          {...register('status')}
          error={errors.status?.message}
          options={[
            { value: 'active', label: 'Ativo (na despensa)' },
            { value: 'consumed', label: 'Consumido' },
            { value: 'discarded', label: 'Descartado' },
          ]}
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 dark:border-stone-800">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={isLoading} className="px-6">
          {isEditing ? 'Salvar alterações' : 'Salvar lote'}
        </Button>
      </div>
    </form>
  );
}
