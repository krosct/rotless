import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HouseholdActivities } from './HouseholdActivities';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Ana', email: 'ana@rotless.dev', households: [] },
    currentHousehold: { id: 7, name: 'Casa' },
    setCurrentHousehold: vi.fn(),
    logout: vi.fn(),
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('@/api/households', () => ({
  listHouseholdActors: vi.fn().mockResolvedValue([]),
  listHouseholdActivities: vi.fn().mockResolvedValue({
    data: [
      {
        id: 2,
        action: 'updated',
        created_at: '2026-09-29T15:04:00Z',
        user: { id: 3, name: 'Marina Costa' },
        subject: null,
        batch_id: 9,
        product_name: 'Iogurte natural',
        quantity: null,
        changes: { expires_at: { from: '2026-10-01', to: '2026-10-03' } },
      },
      {
        id: 1,
        action: 'consumed',
        created_at: '2026-09-29T12:00:00Z',
        user: { id: 4, name: 'Pedro Alves' },
        subject: null,
        batch_id: 9,
        product_name: 'Iogurte natural',
        quantity: 2,
        changes: { quantity: { from: 6, to: 4 } },
      },
    ],
    meta: { next_before: null },
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/households/:householdId/activities" element={<HouseholdActivities />} />
        <Route path="/households/:householdId/settings" element={<p>household settings 7</p>} />
        <Route path="/settings" element={<p>user settings</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('HouseholdActivities', () => {
  it('says who did what and what changed, from -> to', async () => {
    renderAt('/households/7/activities');

    const rows = await screen.findAllByTestId('movement');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Marina Costa editou Iogurte natural');
    expect(rows[0].textContent).toContain('Validade:01/10/2026');
    expect(rows[0].textContent).toContain('03/10/2026');
    expect(rows[1].textContent).toContain('Pedro Alves consumiu 2 un de Iogurte natural');
    expect(rows[1].textContent).toContain('Quantidade:6 un');
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it.each(['Voltar para configurações', 'Voltar'])('"%s" goes back to the household settings', async (label) => {
    renderAt('/households/7/activities');

    fireEvent.click(await screen.findByRole('button', { name: label }));

    expect(await screen.findByText('household settings 7')).toBeTruthy();
    expect(screen.queryByText('user settings')).toBeNull();
  });
});
