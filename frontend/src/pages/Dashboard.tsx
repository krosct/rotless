import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  useBatches,
  useCreateBatch,
  useUpdateBatch,
  useDeleteBatch,
  useUpdateProduct,
} from '@/hooks/useBatches';
import { BatchStatus } from '@/types';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BatchList } from '@/components/batches/BatchList';
import { BatchForm } from '@/components/batches/BatchForm';
import { ConsumeBatchModal, ConsumeAction } from '@/components/batches/ConsumeBatchModal';
import { ProductEditModal } from '@/components/batches/ProductEditModal';
import { Modal } from '@/components/ui/Modal';
import { ProductGroup } from '@/utils/groupBatches';
import { Bell, AlertTriangle, Sparkles } from 'lucide-react';
import { expiryTone } from '@/utils/expiry';

export function Dashboard() {
  const { currentHousehold, user } = useAuth();
  const { data: batches = [], isLoading } = useBatches(currentHousehold?.id);
  const createMutation = useCreateBatch();
  const updateMutation = useUpdateBatch();
  const deleteMutation = useDeleteBatch();
  const updateProductMutation = useUpdateProduct();

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  const [consumeTarget, setConsumeTarget] = useState<{
    group: ProductGroup;
    action: ConsumeAction;
  } | null>(null);

  const handleOpenNewModal = () => {
    setIsNewModalOpen(true);
  };

  const handleCloseNewModal = () => {
    setIsNewModalOpen(false);
  };

  const handleCreateSubmit = async (formData: {
    household_id?: number;
    barcode?: string;
    name?: string;
    quantity: number;
    expires_at: string;
    photo?: File | null;
  }) => {
    await createMutation.mutateAsync({
      ...formData,
      household_id: currentHousehold?.id || formData.household_id,
    });
    setIsNewModalOpen(false);
  };

  const handleConsumeRequest = (group: ProductGroup, action: ConsumeAction) => {
    setConsumeTarget({ group, action });
  };

  const handleConsumeConfirm = async (batchId: number, quantity: number) => {
    if (!consumeTarget) return;

    const entry = consumeTarget.group.entries.find((item) => item.batch.id === batchId);
    if (!entry) return;

    const isFullQuantity = quantity >= entry.quantity;

    await updateMutation.mutateAsync({
      id: batchId,
      input: isFullQuantity
        ? { status: consumeTarget.action }
        : { quantity: entry.quantity - quantity },
    });

    setConsumeTarget(null);
  };

  const handleSaveProduct = async (input: { name: string; photo: File | null }) => {
    if (!editingGroup) return;
    await updateProductMutation.mutateAsync({
      id: editingGroup.productId,
      input,
    });
  };

  const handleSaveEntry = async (
    batchId: number,
    input: { quantity: number; expires_at: string; status: BatchStatus }
  ) => {
    await updateMutation.mutateAsync({ id: batchId, input });
  };

  const handleConsumeAll = async (action: ConsumeAction) => {
    if (!editingGroup) return;

    const activeEntries = editingGroup.entries.filter(
      (entry) => entry.batch.status === 'active'
    );

    await Promise.all(
      activeEntries.map((entry) =>
        updateMutation.mutateAsync({ id: entry.batch.id, input: { status: action } })
      )
    );

    setEditingGroup(null);
  };

  const handleDeleteBatch = (id: number) => {
    if (window.confirm('Tem certeza que deseja remover este lote da despensa?')) {
      deleteMutation.mutate(id);
    }
  };

  // Urgent notice if active batches are expiring soon or expired
  const expiringCount = batches.filter(
    (b) => b.status === 'active' && expiryTone(b.expires_at) === 'soon'
  ).length;

  const expiredCount = batches.filter(
    (b) => b.status === 'active' && expiryTone(b.expires_at) === 'overdue'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 transition-colors">
      <Header onOpenNewBatchModal={handleOpenNewModal} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top welcome & alert banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Despensa Inteligente
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              {currentHousehold?.name || 'Sua despensa'} &bull; Olá, {user?.name.split(' ')[0]}!
            </p>
          </div>

          {/* Quick status counters */}
          <div className="flex items-center gap-2">
            {expiringCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                <span>{expiringCount} vencendo logo</span>
              </div>
            )}

            {expiredCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>{expiredCount} vencido(s)</span>
              </div>
            )}

            {expiringCount === 0 && expiredCount === 0 && batches.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tudo em dia</span>
              </div>
            )}
          </div>
        </div>

        {/* Batches list */}
        <BatchList
          batches={batches}
          isLoading={isLoading}
          onAddNew={handleOpenNewModal}
          onEditGroup={(group) => setEditingGroup(group)}
          onConsume={handleConsumeRequest}
          onDeleteBatch={handleDeleteBatch}
        />
      </main>

      {/* Create Batch Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={handleCloseNewModal}
        title="Adicionar Lote de Alimento"
        description="Escaneie o código de barras ou insira os dados manualmente."
        maxWidth="lg"
      >
        <BatchForm
          householdId={currentHousehold?.id}
          onSubmit={handleCreateSubmit}
          onCancel={handleCloseNewModal}
          isLoading={createMutation.isPending}
        />
      </Modal>

      {/* Product Edit Modal */}
      <ProductEditModal
        isOpen={!!editingGroup}
        group={editingGroup}
        isLoading={updateMutation.isPending || updateProductMutation.isPending}
        onClose={() => setEditingGroup(null)}
        onSaveProduct={handleSaveProduct}
        onSaveEntry={handleSaveEntry}
        onConsumeAll={handleConsumeAll}
      />

      {/* Consume / Discard Confirmation Modal */}
      <ConsumeBatchModal
        isOpen={!!consumeTarget}
        action={consumeTarget?.action ?? 'consumed'}
        productName={consumeTarget?.group.product.name ?? ''}
        entries={consumeTarget?.group.entries ?? []}
        isLoading={updateMutation.isPending}
        onClose={() => setConsumeTarget(null)}
        onConfirm={handleConsumeConfirm}
      />

      <Footer />
    </div>
  );
}
