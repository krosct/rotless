import { Batch } from '@/types';

export interface BatchEntry {
  batch: Batch;
  quantity: number;
  expires_at: string;
}

export interface ProductGroup {
  productId: number;
  product: Batch['product'];
  entries: BatchEntry[];
  totalQuantity: number;
  earliestExpiresAt: string;
  status: Batch['status'];
}

/**
 * Groups batches by product so the dashboard shows a single card per product.
 * Entries are ordered by expiry date ascending (closest expiry first).
 */
export function groupBatchesByProduct(batches: Batch[]): ProductGroup[] {
  const groups = new Map<number, ProductGroup>();

  for (const batch of batches) {
    const existing = groups.get(batch.product.id);

    if (existing) {
      existing.entries.push({
        batch,
        quantity: batch.quantity,
        expires_at: batch.expires_at,
      });
      existing.totalQuantity += batch.quantity;
      if (batch.expires_at < existing.earliestExpiresAt) {
        existing.earliestExpiresAt = batch.expires_at;
      }
      continue;
    }

    groups.set(batch.product.id, {
      productId: batch.product.id,
      product: batch.product,
      entries: [
        {
          batch,
          quantity: batch.quantity,
          expires_at: batch.expires_at,
        },
      ],
      totalQuantity: batch.quantity,
      earliestExpiresAt: batch.expires_at,
      status: batch.status,
    });
  }

  return Array.from(groups.values()).map((group) => {
    const entries = [...group.entries].sort((a, b) => a.expires_at.localeCompare(b.expires_at));
    const activeEntries = entries.filter((entry) => entry.batch.status === 'active');

    return {
      ...group,
      entries,
      // The group is active while any entry is still active; otherwise it
      // reflects the status of the most recently resolved entry.
      status: activeEntries.length > 0 ? 'active' : entries[entries.length - 1].batch.status,
      totalQuantity: activeEntries.reduce((sum, entry) => sum + entry.quantity, 0),
      earliestExpiresAt: activeEntries[0]?.expires_at ?? entries[0].expires_at,
    };
  });
}
