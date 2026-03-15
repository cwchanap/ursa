import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AnalysisModeTabs from './AnalysisModeTabs.svelte';

describe('AnalysisModeTabs Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders a tablist with three tabs', () => {
      render(AnalysisModeTabs);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('renders Detection, Classify, and OCR tabs', () => {
      render(AnalysisModeTabs);
      expect(screen.getByRole('tab', { name: /detection/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /classify/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /ocr/i })).toBeInTheDocument();
    });

    it('defaults to detection mode selected', () => {
      render(AnalysisModeTabs);
      const detectionTab = screen.getByRole('tab', { name: /detection/i });
      expect(detectionTab).toHaveAttribute('aria-selected', 'true');
    });

    it('shows classification tab as selected when activeMode is classification', async () => {
      render(AnalysisModeTabs, { props: { activeMode: 'classification' } });
      const classifyTab = screen.getByRole('tab', { name: /classify/i });
      expect(classifyTab).toHaveAttribute('aria-selected', 'true');
    });

    it('shows OCR tab as selected when activeMode is ocr', () => {
      render(AnalysisModeTabs, { props: { activeMode: 'ocr' } });
      const ocrTab = screen.getByRole('tab', { name: /ocr/i });
      expect(ocrTab).toHaveAttribute('aria-selected', 'true');
    });

    it('active tab has tabindex 0 and others have tabindex -1', () => {
      render(AnalysisModeTabs, { props: { activeMode: 'detection' } });
      const [detTab, classTab, ocrTab] = screen.getAllByRole('tab');
      expect(detTab).toHaveAttribute('tabindex', '0');
      expect(classTab).toHaveAttribute('tabindex', '-1');
      expect(ocrTab).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('click interactions', () => {
    it('calls onModeChange when a different tab is clicked', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'detection', onModeChange } });
      const classifyTab = screen.getByRole('tab', { name: /classify/i });
      await fireEvent.click(classifyTab);
      expect(onModeChange).toHaveBeenCalledWith('classification');
    });

    it('calls onModeChange with ocr when OCR tab is clicked', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'detection', onModeChange } });
      const ocrTab = screen.getByRole('tab', { name: /ocr/i });
      await fireEvent.click(ocrTab);
      expect(onModeChange).toHaveBeenCalledWith('ocr');
    });

    it('does not call onModeChange when active tab is clicked', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'detection', onModeChange } });
      const detectionTab = screen.getByRole('tab', { name: /detection/i });
      await fireEvent.click(detectionTab);
      expect(onModeChange).not.toHaveBeenCalled();
    });

    it('works without onModeChange callback (no crash)', async () => {
      render(AnalysisModeTabs, { props: { activeMode: 'detection' } });
      const classifyTab = screen.getByRole('tab', { name: /classify/i });
      await expect(fireEvent.click(classifyTab)).resolves.not.toThrow();
    });
  });

  describe('keyboard navigation', () => {
    it('moves to next tab with ArrowRight', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'detection', onModeChange } });
      const detectionTab = screen.getByRole('tab', { name: /detection/i });
      await fireEvent.keyDown(detectionTab, { key: 'ArrowRight' });
      expect(onModeChange).toHaveBeenCalledWith('classification');
    });

    it('wraps to first tab with ArrowRight from last tab', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'ocr', onModeChange } });
      const ocrTab = screen.getByRole('tab', { name: /ocr/i });
      await fireEvent.keyDown(ocrTab, { key: 'ArrowRight' });
      expect(onModeChange).toHaveBeenCalledWith('detection');
    });

    it('moves to previous tab with ArrowLeft', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'classification', onModeChange } });
      const classifyTab = screen.getByRole('tab', { name: /classify/i });
      await fireEvent.keyDown(classifyTab, { key: 'ArrowLeft' });
      expect(onModeChange).toHaveBeenCalledWith('detection');
    });

    it('wraps to last tab with ArrowLeft from first tab', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'detection', onModeChange } });
      const detectionTab = screen.getByRole('tab', { name: /detection/i });
      await fireEvent.keyDown(detectionTab, { key: 'ArrowLeft' });
      expect(onModeChange).toHaveBeenCalledWith('ocr');
    });

    it('moves to first tab with Home key', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'ocr', onModeChange } });
      const ocrTab = screen.getByRole('tab', { name: /ocr/i });
      await fireEvent.keyDown(ocrTab, { key: 'Home' });
      expect(onModeChange).toHaveBeenCalledWith('detection');
    });

    it('moves to last tab with End key', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'detection', onModeChange } });
      const detectionTab = screen.getByRole('tab', { name: /detection/i });
      await fireEvent.keyDown(detectionTab, { key: 'End' });
      expect(onModeChange).toHaveBeenCalledWith('ocr');
    });

    it('ignores unrelated keys', async () => {
      const onModeChange = vi.fn();
      render(AnalysisModeTabs, { props: { activeMode: 'detection', onModeChange } });
      const detectionTab = screen.getByRole('tab', { name: /detection/i });
      await fireEvent.keyDown(detectionTab, { key: 'Enter' });
      expect(onModeChange).not.toHaveBeenCalled();
    });
  });

  describe('results indicators', () => {
    it('shows results indicator when hasDetectionResults is true', () => {
      render(AnalysisModeTabs, { props: { hasDetectionResults: true } });
      const indicators = screen.getAllByLabelText('Has results');
      expect(indicators.length).toBeGreaterThan(0);
    });

    it('shows no indicators by default', () => {
      render(AnalysisModeTabs);
      expect(screen.queryByLabelText('Has results')).toBeNull();
    });

    it('shows indicator for classification results', () => {
      render(AnalysisModeTabs, { props: { hasClassificationResults: true } });
      const indicators = screen.getAllByLabelText('Has results');
      expect(indicators.length).toBe(1);
    });

    it('shows indicator for OCR results', () => {
      render(AnalysisModeTabs, { props: { hasOCRResults: true } });
      const indicators = screen.getAllByLabelText('Has results');
      expect(indicators.length).toBe(1);
    });

    it('can show multiple indicators simultaneously', () => {
      render(AnalysisModeTabs, {
        props: { hasDetectionResults: true, hasClassificationResults: true, hasOCRResults: true },
      });
      const indicators = screen.getAllByLabelText('Has results');
      expect(indicators.length).toBe(3);
    });
  });

  describe('accessibility', () => {
    it('tablist has accessible label', () => {
      render(AnalysisModeTabs);
      const tablist = screen.getByRole('tablist', { name: /analysis modes/i });
      expect(tablist).toBeInTheDocument();
    });

    it('each tab has aria-controls attribute', () => {
      render(AnalysisModeTabs);
      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-controls');
      });
    });
  });
});
