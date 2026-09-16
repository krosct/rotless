import { z } from 'zod';
import { apiFetch } from './client';

const productSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const batchSchema = z.object({
  id: z.number(),
  product: productSchema,
  quantity: z.number(),
  expires_at: z.string(),
  status: z.enum(['active', 'consumed', 'discarded']),
});

export type Batch = z.infer<typeof batchSchema>;

const batchListSchema = z.object({
  data: z.array(batchSchema),
});

export async function listBatches(): Promise<Batch[]> {
  const data = await apiFetch<unknown>('/api/v1/batches');
  return batchListSchema.parse(data).data;
}

export interface CreateBatchInput {
  household_id: number;
  product_id?: number;
  barcode?: string;
  name?: string;
  quantity: number;
  expires_at: string;
  photo?: File;
}

const createBatchResponseSchema = z.object({
  data: batchSchema,
});

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const formData = new FormData();
  formData.append('household_id', String(input.household_id));
  if (input.product_id !== undefined) {
    formData.append('product_id', String(input.product_id));
  }
  if (input.barcode !== undefined) {
    formData.append('barcode', input.barcode);
  }
  if (input.name !== undefined) {
    formData.append('name', input.name);
  }
  formData.append('quantity', String(input.quantity));
  formData.append('expires_at', input.expires_at);
  if (input.photo !== undefined) {
    formData.append('photo', input.photo);
  }

  const data = await apiFetch<unknown>('/api/v1/batches', { method: 'POST', body: formData });
  return createBatchResponseSchema.parse(data).data;
}
