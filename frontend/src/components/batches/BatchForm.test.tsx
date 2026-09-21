import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchForm } from './BatchForm';
import { addDays, format } from 'date-fns';

describe('BatchForm component', () => {
  const futureDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');

  it('alterna entre abas de Código de barras e Manual', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<BatchForm onSubmit={handleSubmit} />);

    // Inicia na aba "Código de barras"
    expect(screen.getByLabelText(/Código de barras/i)).toBeDefined();

    // Clica na aba "Manual"
    const manualTab = screen.getByRole('tab', { name: /Manual/i });
    await user.click(manualTab);

    // Agora deve ter campo "Nome do produto"
    expect(screen.getByLabelText(/Nome do produto/i)).toBeDefined();
  });

  it('submete dados no modo manual com nome, quantidade e validade', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(<BatchForm onSubmit={handleSubmit} />);

    // Alterna para manual
    const manualTab = screen.getByRole('tab', { name: /Manual/i });
    await user.click(manualTab);

    const nameInput = screen.getByLabelText(/Nome do produto/i);
    await user.type(nameInput, 'Arroz Integral 1kg');

    const dateInput = screen.getByLabelText(/Data de validade/i);
    await user.type(dateInput, futureDate);

    const submitBtn = screen.getByRole('button', { name: /Salvar lote/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Arroz Integral 1kg',
          quantity: 1,
          expires_at: futureDate,
        })
      );
    });
  });

  it('permite upload de foto no modo manual', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(<BatchForm onSubmit={handleSubmit} />);

    const manualTab = screen.getByRole('tab', { name: /Manual/i });
    await user.click(manualTab);

    // Arquivo fake
    const file = new File(['fake-image'], 'tomate.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(fileInput.files?.[0]).toBe(file);
    expect(fileInput.files).toHaveLength(1);
  });
});
