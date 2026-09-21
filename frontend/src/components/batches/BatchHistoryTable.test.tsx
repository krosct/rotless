import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatchHistoryTable } from './BatchHistoryTable';
import { Batch } from '@/types';

function makeBatch(overrides: Partial<Batch> & { id: number }): Batch {
  return {
    id: overrides.id,
    product: overrides.product ?? { id: 10, name: 'Leite' },
    quantity: overrides.quantity ?? 1,
    expires_at: overrides.expires_at ?? '2026-10-01',
    status: overrides.status ?? 'active',
    created_at: overrides.created_at ?? '2026-09-20T10:00:00Z',
    updated_at: overrides.updated_at ?? '2026-09-21T12:00:00Z',
    created_by: overrides.created_by ?? { id: 1, name: 'Ana' },
    updated_by: overrides.updated_by ?? { id: 2, name: 'Bruno' },
  };
}

describe('BatchHistoryTable', () => {
  it('lista todas as operações em formato de tabela', () => {
    const batches = [
      makeBatch({ id: 1, status: 'consumed' }),
      makeBatch({
        id: 2,
        status: 'discarded',
        product: { id: 20, name: 'Arroz' },
      }),
    ];

    render(<BatchHistoryTable batches={batches} />);

    expect(screen.getByTestId('batch-history-table')).toBeDefined();
    expect(screen.getAllByTestId('history-row')).toHaveLength(2);
    expect(screen.getByText('Leite')).toBeDefined();
    expect(screen.getByText('Arroz')).toBeDefined();
    expect(screen.getByText('Consumido')).toBeDefined();
    expect(screen.getByText('Descartado')).toBeDefined();
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bruno').length).toBeGreaterThan(0);
  });

  it('mostra estado vazio quando não há operações', () => {
    render(<BatchHistoryTable batches={[]} />);

    expect(screen.getByText(/Nenhuma operação registrada/i)).toBeDefined();
    expect(screen.queryByTestId('batch-history-table')).toBeNull();
  });
});
