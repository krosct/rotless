import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout demo shortcut', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after three quick taps on the shield', () => {
    const onTripleTap = vi.fn();
    render(<AuthLayout onShieldTripleTap={onTripleTap}>form</AuthLayout>);
    const shield = screen.getByTestId('demo-shield');

    fireEvent.click(shield);
    fireEvent.click(shield);
    expect(onTripleTap).not.toHaveBeenCalled();

    fireEvent.click(shield);
    expect(onTripleTap).toHaveBeenCalledTimes(1);
  });

  it('ignores slow taps and taps next to the shield', () => {
    vi.useFakeTimers();
    const onTripleTap = vi.fn();
    render(<AuthLayout onShieldTripleTap={onTripleTap}>form</AuthLayout>);
    const shield = screen.getByTestId('demo-shield');

    fireEvent.click(shield);
    vi.advanceTimersByTime(1000);
    fireEvent.click(shield);
    vi.advanceTimersByTime(1000);
    fireEvent.click(shield);

    fireEvent.click(screen.getByText('Zero Desperdício'));
    fireEvent.click(screen.getByText('Zero Desperdício'));
    fireEvent.click(screen.getByText('Zero Desperdício'));

    expect(onTripleTap).not.toHaveBeenCalled();
  });
});
