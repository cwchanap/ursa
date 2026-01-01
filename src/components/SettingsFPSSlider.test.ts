import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// Create mock store that can be reset
const createMockStore = () => {
  const store = writable(5);
  return {
    store,
    updateFn: vi.fn((value: number) => {
      store.set(value);
    }),
  };
};

let mockData = createMockStore();

// Mock the settings store module
vi.mock('../lib/stores/settingsStore', () => ({
  get videoFPS() {
    return mockData.store;
  },
  get updateVideoFPS() {
    return mockData.updateFn;
  },
}));

import SettingsFPSSlider from './SettingsFPSSlider.svelte';

describe('SettingsFPSSlider', () => {
  beforeEach(() => {
    // Reset mock data before each test
    mockData = createMockStore();
    vi.clearAllMocks();
  });

  it('renders the slider', () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider', { name: /video frames per second/i });
    expect(slider).toBeInTheDocument();
  });

  it('displays "Video FPS" label', () => {
    render(SettingsFPSSlider);

    expect(screen.getByText('Video FPS')).toBeInTheDocument();
  });

  it('shows FPS value', () => {
    render(SettingsFPSSlider);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('fps')).toBeInTheDocument();
  });

  it('has correct min and max attributes', () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '15');
  });

  it('calls updateVideoFPS on change', async () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '10' } });

    expect(mockData.updateFn).toHaveBeenCalledWith(10);
  });

  it('shows Battery Saver label for low FPS (1-3)', async () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '2' } });

    expect(screen.getByText('Battery Saver')).toBeInTheDocument();
  });

  it('shows Balanced label for medium FPS (4-7)', async () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '5' } });

    expect(screen.getByText('Balanced')).toBeInTheDocument();
  });

  it('shows Smooth label for high FPS (8-10)', async () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '9' } });

    expect(screen.getByText('Smooth')).toBeInTheDocument();
  });

  it('shows High Performance label for ultra FPS (11+)', async () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '12' } });

    expect(screen.getByText('High Performance')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(SettingsFPSSlider, { props: { disabled: true } });

    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(SettingsFPSSlider, { props: { className: 'custom-class' } });

    const wrapper = container.querySelector('.fps-slider');
    expect(wrapper).toHaveClass('custom-class');
  });

  it('shows slider markers for min, mid, and max values', () => {
    render(SettingsFPSSlider);

    // Check for marker values (1, 8, 15)
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(SettingsFPSSlider);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '15');
    // Check the current value which should be 5 (from the mock store)
    expect(slider).toHaveAttribute('aria-valuenow', '5');
  });
});
