import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as batchesApi from '@/api/batches';
import { toast } from 'sonner';

export const BATCHES_QUERY_KEY = ['batches'];

export function useBatches(householdId?: number) {
  return useQuery({
    queryKey: [...BATCHES_QUERY_KEY, householdId],
    queryFn: () => batchesApi.listBatches(householdId),
  });
}

export function useBatch(id: number | string | undefined) {
  return useQuery({
    queryKey: ['batch', id],
    queryFn: () => (id ? batchesApi.getBatch(id) : null),
    enabled: !!id,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: batchesApi.CreateBatchInput) => batchesApi.createBatch(input),
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: BATCHES_QUERY_KEY });
      toast.success(`Lote de "${newBatch.product.name}" adicionado à despensa!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível salvar o lote.');
    },
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number | string; input: batchesApi.UpdateBatchInput }) =>
      batchesApi.updateBatch(id, input),
    onSuccess: (updatedBatch) => {
      queryClient.invalidateQueries({ queryKey: BATCHES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['batch', String(updatedBatch.id)] });
      toast.success(`Lote atualizado com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar lote.');
    },
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => batchesApi.deleteBatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BATCHES_QUERY_KEY });
      toast.success('Lote removido da despensa.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover lote.');
    },
  });
}
