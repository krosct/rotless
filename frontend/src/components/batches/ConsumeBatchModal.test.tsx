import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsumeBatchModal } from './ConsumeBatchModal';
import { BatchEntry } from '@/utils/groupBatches';

function makeEntry(id: number, quantity: number, expiresAt: string): BatchEntry {
  return {
    batch: {
      id,
      product: { id: 10, name: 'Leite' },
      quantity,
      expires_at: expiresAt,
      status: 'active',
    },
    quantity,
    expires_at: expiresAt,
  };
}

describe('ConsumeBatchModal', () => {
  it('pré-seleciona a entrada com validade mais próxima e a quantidade total', async () => {
    const entries = [
      makeEntry(1, 2, '2026-10-01'),
      makeEntry(2, 5, '2026-11-01'),
    ];
    const onConfirm = vi.fn();

    render(
      <ConsumeBatchModal
        isOpen
        action="consumed"
        productName="Leite"
        entries={entries}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const quantityInput = screen.getByLabelText(/Quantidade/i) as HTMLInputElement;
    expect(quantityInput.value).toBe('2');

    await userEvent.click(screen.getByRole('button', { name: /Confirmar consumo/i }));

    expect(onConfirm).toHaveBeenCalledWith(1, 2);
  });

  it('permite escolher outra entrada e confirma com a quantidade dela', async () => {
    const entries = [
      makeEntry(1, 2, '2026-10-01'),
      makeEntry(2, 5, '2026-11-01'),
    ];
    const onConfirm = vi.fn();

    render(
      <ConsumeBatchModal
        isOpen
        action="discarded"
        productName="Leite"
        entries={entries}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    await userEvent.click(screen.getByText(/01\/11\/2026/));
    await userEvent.click(screen.getByRole('button', { name: /Confirmar descarte/i }));

    expect(onConfirm).toHaveBeenCalledWith(2, 5);
  });
});
