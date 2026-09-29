import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { HouseholdReports } from './HouseholdReports';
import type { HouseholdReport } from '@/types';

const auth = vi.hoisted(() => ({ role: 'owner' as 'owner' | 'manager' | 'member' }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Ana', email: 'a@x', households: [{ id: 7, name: 'Casa', role: auth.role }] },
    currentHousehold: { id: 7, name: 'Casa' },
    setCurrentHousehold: vi.fn(),
    logout: vi.fn(),
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

const today = format(new Date(), 'yyyy-MM-dd');

vi.mock('@/hooks/useBatches', () => ({
  useBatches: () => ({
    data: [
      { id: 1, product: { id: 1, name: 'Leite' }, quantity: 3, expires_at: today, status: 'active' },
      { id: 2, product: { id: 2, name: 'Arroz' }, quantity: 2, expires_at: '2099-01-01', status: 'active' },
    ],
  }),
}));

const report: HouseholdReport = {
  period: { days: 30, from: '2026-08-31', to: '2026-09-29', timezone: 'America/Sao_Paulo', bucket: 'day' },
  totals: { added_units: 20, consumed_units: 12, discarded_units: 4, use_rate: 0.75, operations: 30, avg_days_to_consume: 3.5 },
  previous: { added_units: 10, consumed_units: 6, discarded_units: 4, use_rate: 0.6 },
  timeline: [
    { date: '2026-09-28', consumed: 2, discarded: 1 },
    { date: '2026-09-29', consumed: 1, discarded: 0 },
  ],
  top_consumed: [{ product_name: 'Leite', units: 8 }],
  top_discarded: [{ product_name: 'Alface', units: 3 }],
  members: [
    { user: { id: 1, name: 'Ana' }, is_member: true, added: 5, consumed: 4, discarded: 1, other: 2, total: 12 },
  ],
};

vi.mock('@/api/households', () => ({
  getHouseholdReport: vi.fn(async () => report),
}));

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/households/7/reports']}>
        <Routes>
          <Route path="/households/:householdId/reports" element={<HouseholdReports />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HouseholdReports', () => {
  beforeEach(() => {
    auth.role = 'owner';
  });

  it('leads with the use rate and says where to act', async () => {
    renderPage();

    expect(await screen.findByText('75%')).toBeTruthy();
    expect(screen.getByText(/15 p\.p\. vs período anterior/)).toBeTruthy();
    expect(screen.getByText(/3 un vencem nos próximos 3 dias/)).toBeTruthy();
    expect(screen.getByText(/"Alface" foi o mais descartado/)).toBeTruthy();
    expect(screen.getByText('Em risco agora')).toBeTruthy();
  });

  it('shows any chart as a table', async () => {
    renderPage();
    await screen.findByText('75%');

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver tabela' })[0]);

    expect(screen.getByRole('columnheader', { name: 'Consumido' })).toBeTruthy();
    expect(screen.getByText('28/09/2026')).toBeTruthy();
  });

  it('is only for owners and managers', () => {
    auth.role = 'member';
    renderPage();

    expect(screen.getByText(/ficam disponíveis para o dono e os gerentes/)).toBeTruthy();
  });
});
