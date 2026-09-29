import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('shows the site version', () => {
    render(<Footer />);

    expect(screen.getByTitle('Versão do site').textContent).toBe(__APP_VERSION__);
    expect(__APP_VERSION__).not.toBe('');
  });
});
