import type { Batch } from '../api/batches';
import { expiryTone } from '../utils/expiry';

const TONE_LABEL: Record<string, string> = {
  ok: 'Fresh',
  soon: 'Expiring soon',
  overdue: 'Expired',
};

interface BatchListProps {
  batches: Batch[];
}

export function BatchList({ batches }: BatchListProps) {
  if (batches.length === 0) {
    return <p>No batches yet. Add your first one below.</p>;
  }

  return (
    <ul>
      {batches.map((batch) => {
        const tone = expiryTone(batch.expires_at);
        return (
          <li key={batch.id} data-tone={tone}>
            <strong>{batch.product.name}</strong> × {batch.quantity} — expires {batch.expires_at} (
            {TONE_LABEL[tone]})
          </li>
        );
      })}
    </ul>
  );
}
