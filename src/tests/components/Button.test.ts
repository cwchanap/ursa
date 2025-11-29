import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Button from '../../components/Button.svelte';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import confetti from 'canvas-confetti';

describe('Button Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with slot content', async () => {
    render(Button);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('has correct styling classes', async () => {
    render(Button);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-purple-500');
    expect(button).toHaveClass('text-white');
    expect(button).toHaveClass('rounded-lg');
  });

  it('triggers confetti on click', async () => {
    render(Button);
    
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    
    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it('triggers confetti multiple times on multiple clicks', async () => {
    render(Button);
    
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    await fireEvent.click(button);
    await fireEvent.click(button);
    
    expect(confetti).toHaveBeenCalledTimes(3);
  });
});
