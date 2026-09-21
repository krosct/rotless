import { apiClient } from './client';
import { Batch, BatchStatus, Product } from '@/types';

export interface CreateBatchInput {
  household_id?: number;
  barcode?: string;
  name?: string;
  quantity: number;
  expires_at: string;
  photo?: File | null;
}

export interface UpdateBatchInput {
  quantity?: number;
  expires_at?: string;
  status?: BatchStatus;
}

interface DataEnvelope<T> {
  data: T;
}

function unwrap<T>(payload: T | DataEnvelope<T>): T {
  if (payload !== null && typeof payload === 'object' && 'data' in payload) {
    return (payload as DataEnvelope<T>).data;
  }
  return payload as T;
}

export async function listBatches(householdId?: number): Promise<Batch[]> {
  const query = householdId ? `?household_id=${householdId}` : '';
  const payload = await apiClient<Batch[] | DataEnvelope<Batch[]>>(`/api/v1/batches${query}`, {
    method: 'GET',
  });
  return unwrap(payload);
}

export async function getBatch(id: number | string): Promise<Batch> {
  const payload = await apiClient<Batch | DataEnvelope<Batch>>(`/api/v1/batches/${id}`, {
    method: 'GET',
  });
  return unwrap(payload);
}

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const formData = new FormData();

  if (input.household_id) {
    formData.append('household_id', String(input.household_id));
  }
  if (input.barcode) {
    formData.append('barcode', input.barcode.trim());
  }
  if (input.name) {
    formData.append('name', input.name.trim());
  }
  formData.append('quantity', String(Math.floor(input.quantity)));
  formData.append('expires_at', input.expires_at);

  if (input.photo) {
    formData.append('photo', input.photo);
  }

  const payload = await apiClient<Batch | DataEnvelope<Batch>>('/api/v1/batches', {
    method: 'POST',
    body: formData,
  });
  return unwrap(payload);
}

export async function updateBatch(id: number | string, input: UpdateBatchInput): Promise<Batch> {
  const payload = await apiClient<Batch | DataEnvelope<Batch>>(`/api/v1/batches/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return unwrap(payload);
}

export async function deleteBatch(id: number | string): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/api/v1/batches/${id}`, {
    method: 'DELETE',
  });
}

export interface UpdateProductInput {
  name?: string;
  photo?: File | null;
}

export async function updateProduct(
  productId: number | string,
  input: UpdateProductInput
): Promise<Product> {
  const formData = new FormData();

  if (input.name) {
    formData.append('name', input.name.trim());
  }
  if (input.photo) {
    formData.append('photo', input.photo);
  }

  const payload = await apiClient<Product | DataEnvelope<Product>>(
    `/api/v1/products/${productId}`,
    {
      method: 'PATCH',
      body: formData,
    }
  );
  return unwrap(payload);
}

export async function lookupBarcode(barcode: string): Promise<{ name: string | null; photo_url?: string | null; barcode: string }> {
  return apiClient<{ name: string | null; photo_url?: string | null; barcode: string }>(`/api/v1/openfoodfacts/${encodeURIComponent(barcode)}`, {
    method: 'GET',
  });
}
