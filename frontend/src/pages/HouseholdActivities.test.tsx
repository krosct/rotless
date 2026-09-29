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
  listHouseholdActivities: vi.fn().mockResolvedValue([]),
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
  it.each(['Voltar para configurações', 'Voltar'])('"%s" goes back to the household settings', async (label) => {
    renderAt('/households/7/activities');

    fireEvent.click(await screen.findByRole('button', { name: label }));

    expect(await screen.findByText('household settings 7')).toBeTruthy();
    expect(screen.queryByText('user settings')).toBeNull();
  });
});
