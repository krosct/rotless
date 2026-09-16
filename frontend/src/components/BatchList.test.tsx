import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatchList } from './BatchList';
import type { Batch } from '../api/batches';

const BATCHES: Batch[] = [
  { id: 1, product: { id: 1, name: 'Rice' }, quantity: 2, expires_at: '2026-12-01', status: 'active' },
  { id: 2, product: { id: 2, name: 'Milk' }, quantity: 1, expires_at: '2000-01-01', status: 'active' },
];

describe('BatchList', () => {
  it('shows an empty message when there are no batches', () => {
    render(<BatchList batches={[]} />);

    expect(screen.getByText(/no batches yet/i)).toBeDefined();
  });

  it('renders each batch with its expiry tone', () => {
    render(<BatchList batches={BATCHES} />);

    expect(screen.getByText('Rice')).toBeDefined();
    expect(screen.getByText('Milk')).toBeDefined();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('data-tone')).toBe('ok');
    expect(items[1]?.getAttribute('data-tone')).toBe('overdue');
  });
});
