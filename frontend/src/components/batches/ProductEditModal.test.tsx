import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductEditModal } from './ProductEditModal';
import { ProductGroup } from '@/utils/groupBatches';

function makeGroup(): ProductGroup {
  return {
    productId: 10,
    product: { id: 10, name: 'Leite' },
    entries: [
      {
        batch: {
          id: 1,
          product: { id: 10, name: 'Leite' },
          quantity: 2,
          expires_at: '2026-10-01',
          status: 'active',
        },
        quantity: 2,
        expires_at: '2026-10-01',
      },
      {
        batch: {
          id: 2,
          product: { id: 10, name: 'Leite' },
          quantity: 5,
          expires_at: '2026-11-01',
          status: 'active',
        },
        quantity: 5,
        expires_at: '2026-11-01',
      },
    ],
    totalQuantity: 7,
    earliestExpiresAt: '2026-10-01',
    status: 'active',
  };
}

describe('ProductEditModal', () => {
  it('lista as entradas e permite consumir tudo', async () => {
    const onConsumeAll = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductEditModal
        isOpen
        group={makeGroup()}
        onClose={vi.fn()}
        onSaveProduct={vi.fn()}
        onSaveEntry={vi.fn()}
        onConsumeAll={onConsumeAll}
      />
    );

    expect(screen.getAllByTestId('edit-entry-row')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: /Consumir tudo/i }));

    expect(onConsumeAll).toHaveBeenCalledWith('consumed');
  });

  it('abre a edição de uma entrada específica ao clicar nela', async () => {
    const onSaveEntry = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductEditModal
        isOpen
        group={makeGroup()}
        onClose={vi.fn()}
        onSaveProduct={vi.fn()}
        onSaveEntry={onSaveEntry}
        onConsumeAll={vi.fn()}
      />
    );

    await userEvent.click(screen.getAllByTestId('edit-entry-row')[1]);

    const quantityInput = screen.getByLabelText(/Quantidade/i) as HTMLInputElement;
    expect(quantityInput.value).toBe('5');

    await userEvent.click(screen.getByRole('button', { name: /Salvar entrada/i }));

    expect(onSaveEntry).toHaveBeenCalledWith(2, {
      quantity: 5,
      expires_at: '2026-11-01',
      status: 'active',
    });
  });
});
