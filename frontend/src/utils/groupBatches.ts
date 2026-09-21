import { Batch } from '@/types';

export interface BatchEntry {
  batch: Batch;
  quantity: number;
  expires_at: string;
}

export interface ProductGroup {
  productId: number;
  product: Batch['product'];
  /** Only active entries; resolved ones are counted in resolvedCount. */
  entries: BatchEntry[];
  totalQuantity: number;
  earliestExpiresAt: string;
  status: Batch['status'];
  resolvedCount: number;
}

/**
 * Groups batches by product so the dashboard shows a single card per product.
 * Active entries are ordered by expiry date ascending (closest expiry first).
 * Consumed/discarded entries are excluded from `entries` and counted in
 * `resolvedCount`, so the card reflects what is actually in the pantry.
 */
export function groupBatchesByProduct(batches: Batch[]): ProductGroup[] {
  const groups = new Map<number, ProductGroup>();

  for (const batch of batches) {
    const existing = groups.get(batch.product.id);

    if (existing) {
      if (batch.status === 'active') {
        existing.entries.push({
          batch,
          quantity: batch.quantity,
          expires_at: batch.expires_at,
        });
      } else {
        existing.resolvedCount += 1;
      }
      continue;
    }

    groups.set(batch.product.id, {
      productId: batch.product.id,
      product: batch.product,
      entries:
        batch.status === 'active'
          ? [
              {
                batch,
                quantity: batch.quantity,
                expires_at: batch.expires_at,
              },
            ]
          : [],
      totalQuantity: 0,
      earliestExpiresAt: batch.expires_at,
      status: batch.status,
      resolvedCount: batch.status === 'active' ? 0 : 1,
    });
  }

  return Array.from(groups.values()).map((group) => {
    const entries = [...group.entries].sort((a, b) => a.expires_at.localeCompare(b.expires_at));
    const hasActive = entries.length > 0;

    return {
      ...group,
      entries,
      status: hasActive ? 'active' : group.status,
      totalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      earliestExpiresAt: entries[0]?.expires_at ?? group.earliestExpiresAt,
    };
  });
}
