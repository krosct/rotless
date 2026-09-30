import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout demo shortcut', () => {
  it('opens the demo with a single click on the shield button', () => {
    const onDemoClick = vi.fn();
    render(<AuthLayout onDemoClick={onDemoClick}>form</AuthLayout>);

    fireEvent.click(screen.getByRole('button', { name: /Abrir demonstração/i }));

    expect(onDemoClick).toHaveBeenCalledTimes(1);
  });

  it('shows the balloon only when asked and the demo is available', () => {
    const { rerender } = render(
      <AuthLayout onDemoClick={vi.fn()} showDemoHint>
        form
      </AuthLayout>
    );
    expect(screen.getByTestId('demo-hint')).toBeDefined();

    rerender(<AuthLayout onDemoClick={vi.fn()}>form</AuthLayout>);
    expect(screen.queryByTestId('demo-hint')).toBeNull();

    rerender(<AuthLayout showDemoHint>form</AuthLayout>);
    expect(screen.queryByTestId('demo-hint')).toBeNull();
  });

  it('keeps the shield as plain decoration without a demo handler', () => {
    render(<AuthLayout>form</AuthLayout>);

    expect(screen.queryByTestId('demo-shield')).toBeNull();
    expect(screen.getByText('Zero Desperdício')).toBeDefined();
  });
});
