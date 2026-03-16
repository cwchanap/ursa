import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import OCRResults from './OCRResults.svelte';
import type { OCRAnalysis } from '../lib/types/analysis';

const mockAnalysis: OCRAnalysis = {
  textRegions: [
    { text: 'Hello', confidence: 90, bbox: { x: 0, y: 0, width: 50, height: 20 } },
    { text: 'World', confidence: 75, bbox: { x: 0, y: 30, width: 60, height: 20 } },
  ],
  fullText: 'Hello\nWorld',
  processingTime: 1500,
  timestamp: '2026-03-15T12:00:00.000Z',
  imageDimensions: { width: 640, height: 480 },
  language: 'eng',
};

describe('OCRResults Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idle state', () => {
    it('shows upload prompt when idle and no analysis', () => {
      render(OCRResults, { props: { processing: { status: 'idle' } } });
      expect(screen.getByText(/upload an image/i)).toBeInTheDocument();
    });

    it('shows language selector in idle state', () => {
      render(OCRResults, { props: { processing: { status: 'idle' } } });
      expect(screen.getByText('Language:')).toBeInTheDocument();
    });

    it('shows default language (English) in dropdown button', () => {
      render(OCRResults, { props: { processing: { status: 'idle' }, currentLanguage: 'eng' } });
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('shows correct language when currentLanguage is set to Spanish', () => {
      render(OCRResults, { props: { processing: { status: 'idle' }, currentLanguage: 'spa' } });
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    it('shows language code in uppercase for unknown language', () => {
      render(OCRResults, { props: { processing: { status: 'idle' }, currentLanguage: 'xyz' } });
      expect(screen.getByText('XYZ')).toBeInTheDocument();
    });
  });

  describe('language dropdown', () => {
    it('opens dropdown when language button is clicked', async () => {
      render(OCRResults, { props: { processing: { status: 'idle' } } });
      const btn = screen.getByRole('button', { name: /english/i });
      await fireEvent.click(btn);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('shows all 9 language options when dropdown is open', async () => {
      render(OCRResults, { props: { processing: { status: 'idle' } } });
      const btn = screen.getByRole('button', { name: /english/i });
      await fireEvent.click(btn);
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(9);
    });

    it('calls onLanguageChange when a different language is selected', async () => {
      const onLanguageChange = vi.fn();
      render(OCRResults, {
        props: { processing: { status: 'idle' }, currentLanguage: 'eng', onLanguageChange },
      });
      const btn = screen.getByRole('button', { name: /english/i });
      await fireEvent.click(btn);
      const frenchOption = screen.getByText('French');
      await fireEvent.click(frenchOption);
      expect(onLanguageChange).toHaveBeenCalledWith('fra');
    });

    it('does not call onLanguageChange when current language is selected again', async () => {
      const onLanguageChange = vi.fn();
      render(OCRResults, {
        props: { processing: { status: 'idle' }, currentLanguage: 'eng', onLanguageChange },
      });
      const dropdownBtn = screen.getByRole('button', { name: /english/i });
      await fireEvent.click(dropdownBtn);
      const englishOptions = screen.getAllByText('English');
      await fireEvent.click(englishOptions[englishOptions.length - 1]);
      expect(onLanguageChange).not.toHaveBeenCalled();
    });

    it('closes dropdown after language selection', async () => {
      render(OCRResults, { props: { processing: { status: 'idle' } } });
      const btn = screen.getByRole('button', { name: /english/i });
      await fireEvent.click(btn);
      const frenchOption = screen.getByText('French');
      await fireEvent.click(frenchOption);
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('dropdown button has aria-haspopup and aria-expanded', () => {
      render(OCRResults, { props: { processing: { status: 'idle' } } });
      const btn = screen.getByRole('button', { name: /english/i });
      expect(btn).toHaveAttribute('aria-haspopup', 'listbox');
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });

    it('aria-expanded becomes true when dropdown opens', async () => {
      render(OCRResults, { props: { processing: { status: 'idle' } } });
      const btn = screen.getByRole('button', { name: /english/i });
      await fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('loading state', () => {
    it('shows loading title when status is loading', () => {
      render(OCRResults, { props: { processing: { status: 'loading' } } });
      expect(screen.getByText(/loading ocr engine/i)).toBeInTheDocument();
    });

    it('shows default loading message when none provided', () => {
      render(OCRResults, { props: { processing: { status: 'loading' } } });
      expect(screen.getByText(/initializing tesseract\.js/i)).toBeInTheDocument();
    });

    it('shows custom loading message', () => {
      render(OCRResults, {
        props: { processing: { status: 'loading', message: 'Downloading language pack...' } },
      });
      expect(screen.getByText('Downloading language pack...')).toBeInTheDocument();
    });

    it('shows progress bar when progress is provided', () => {
      const { container } = render(OCRResults, {
        props: { processing: { status: 'loading', progress: 45 } },
      });
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).not.toBeNull();
      expect(progressBar).toHaveStyle('width: 45%');
    });

    it('does not show progress bar when progress is not provided', () => {
      const { container } = render(OCRResults, {
        props: { processing: { status: 'loading' } },
      });
      expect(container.querySelector('.progress-bar')).toBeNull();
    });
  });

  describe('processing state', () => {
    it('shows processing text when status is processing', () => {
      render(OCRResults, { props: { processing: { status: 'processing' } } });
      expect(screen.getByText(/extracting text from image/i)).toBeInTheDocument();
    });

    it('shows custom processing message', () => {
      render(OCRResults, {
        props: { processing: { status: 'processing', message: 'Running OCR...' } },
      });
      expect(screen.getByText('Running OCR...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error title when status is error', () => {
      render(OCRResults, { props: { processing: { status: 'error' } } });
      expect(screen.getByText(/ocr error/i)).toBeInTheDocument();
    });

    it('shows default error message', () => {
      render(OCRResults, { props: { processing: { status: 'error' } } });
      expect(screen.getByText(/unable to extract text/i)).toBeInTheDocument();
    });

    it('shows custom error message', () => {
      render(OCRResults, {
        props: { processing: { status: 'error', message: 'Worker crashed.' } },
      });
      expect(screen.getByText('Worker crashed.')).toBeInTheDocument();
    });
  });

  describe('results display', () => {
    it('shows "Extracted Text" title when complete with analysis', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('Extracted Text')).toBeInTheDocument();
    });

    it('shows the extracted full text in a pre element', () => {
      const { container } = render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      const pre = container.querySelector('pre.extracted-text');
      expect(pre).not.toBeNull();
      expect(pre!.textContent).toBe('Hello\nWorld');
    });

    it('shows words found count', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('Words Found')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows language in uppercase', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('ENG')).toBeInTheDocument();
    });

    it('shows image dimensions', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('640 × 480')).toBeInTheDocument();
    });

    it('shows processing time badge', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('1.5s')).toBeInTheDocument();
    });

    it('shows "no text found" when fullText is empty', () => {
      const emptyAnalysis = { ...mockAnalysis, fullText: '  ', textRegions: [] };
      render(OCRResults, {
        props: { analysis: emptyAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText(/no text found/i)).toBeInTheDocument();
    });

    it('does not show stats section when textRegions is empty', () => {
      const emptyAnalysis = { ...mockAnalysis, fullText: '  ', textRegions: [] };
      render(OCRResults, {
        props: { analysis: emptyAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.queryByText('Words Found')).toBeNull();
    });

    it('does not show results when processing is not complete', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'processing' } },
      });
      expect(screen.queryByText('Extracted Text')).toBeNull();
    });

    it('shows copy button in results area', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByRole('button', { name: /copy text to clipboard/i })).toBeInTheDocument();
    });

    it('shows "Avg Confidence" stat', () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      expect(screen.getByText('Avg Confidence')).toBeInTheDocument();
    });
  });

  describe('copy to clipboard', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });
    });

    it('copies text and shows success state', async () => {
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      const copyBtn = screen.getByRole('button', { name: /copy text to clipboard/i });
      await fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello\nWorld');
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('calls onCopyText callback after successful copy', async () => {
      const onCopyText = vi.fn();
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' }, onCopyText },
      });
      const copyBtn = screen.getByRole('button', { name: /copy text to clipboard/i });
      await fireEvent.click(copyBtn);
      expect(onCopyText).toHaveBeenCalledWith('Hello\nWorld');
    });

    it('shows error state when clipboard write fails', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
        configurable: true,
        writable: true,
      });
      render(OCRResults, {
        props: { analysis: mockAnalysis, processing: { status: 'complete' } },
      });
      const copyBtn = screen.getByRole('button', { name: /copy text to clipboard/i });
      await fireEvent.click(copyBtn);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('processing time badge colors', () => {
    it('shows fast badge for processingTime < 2000ms', () => {
      const { container } = render(OCRResults, {
        props: {
          analysis: { ...mockAnalysis, processingTime: 1500 },
          processing: { status: 'complete' },
        },
      });
      expect(container.querySelector('.processing-badge.fast')).not.toBeNull();
    });

    it('shows medium badge for processingTime 2000-3000ms', () => {
      const { container } = render(OCRResults, {
        props: {
          analysis: { ...mockAnalysis, processingTime: 2500 },
          processing: { status: 'complete' },
        },
      });
      expect(container.querySelector('.processing-badge.medium')).not.toBeNull();
    });

    it('shows slow badge for processingTime >= 3000ms', () => {
      const { container } = render(OCRResults, {
        props: {
          analysis: { ...mockAnalysis, processingTime: 4000 },
          processing: { status: 'complete' },
        },
      });
      expect(container.querySelector('.processing-badge.slow')).not.toBeNull();
    });
  });

  describe('confidence color classes', () => {
    it('shows high confidence color for avg confidence >= 80', () => {
      const highConfAnalysis: OCRAnalysis = {
        ...mockAnalysis,
        textRegions: [{ text: 'Hi', confidence: 90 }, { text: 'There', confidence: 85 }],
        fullText: 'Hi There',
      };
      const { container } = render(OCRResults, {
        props: { analysis: highConfAnalysis, processing: { status: 'complete' } },
      });
      expect(container.querySelector('.stat-value.high')).not.toBeNull();
    });

    it('shows medium confidence color for avg confidence 50-79', () => {
      const medConfAnalysis: OCRAnalysis = {
        ...mockAnalysis,
        textRegions: [{ text: 'Hi', confidence: 65 }],
        fullText: 'Hi',
      };
      const { container } = render(OCRResults, {
        props: { analysis: medConfAnalysis, processing: { status: 'complete' } },
      });
      expect(container.querySelector('.stat-value.medium')).not.toBeNull();
    });

    it('shows low confidence color for avg confidence < 50', () => {
      const lowConfAnalysis: OCRAnalysis = {
        ...mockAnalysis,
        textRegions: [{ text: 'Hi', confidence: 30 }],
        fullText: 'Hi',
      };
      const { container } = render(OCRResults, {
        props: { analysis: lowConfAnalysis, processing: { status: 'complete' } },
      });
      expect(container.querySelector('.stat-value.low')).not.toBeNull();
    });
  });
});
