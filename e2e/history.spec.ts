import { test, expect } from '@playwright/test';

test.describe('History Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should display history toggle button', async ({ page }) => {
    const historyToggle = page.locator('.history-toggle');
    await expect(historyToggle).toBeVisible({ timeout: 10000 });
  });

  test('should open history panel when toggle is clicked', async ({ page }) => {
    const historyToggle = page.locator('.history-toggle');
    await expect(historyToggle).toBeVisible({ timeout: 10000 });
    await historyToggle.click();

    // Panel should be visible
    const historyPanel = page.locator('.history-panel.open');
    await expect(historyPanel).toBeVisible({ timeout: 5000 });

    // Header should show "History"
    await expect(page.locator('.header-title h2')).toHaveText('History');
  });

  test('should close history panel when close button is clicked', async ({ page }) => {
    // Open panel
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Click close button
    await page.locator('.close-button').click();

    // Panel should be closed (no .open class)
    await expect(page.locator('.history-panel.open')).not.toBeVisible({ timeout: 5000 });
  });

  test('should close history panel when backdrop is clicked', async ({ page }) => {
    // Open panel
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Click backdrop
    await page.locator('.history-backdrop').click();

    // Panel should be closed
    await expect(page.locator('.history-panel.open')).not.toBeVisible({ timeout: 5000 });
  });

  test('should close history panel with Escape key', async ({ page }) => {
    // Open panel
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Panel should be closed
    await expect(page.locator('.history-panel.open')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show empty state when no history', async ({ page }) => {
    // Open panel
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Wait for the panel to have history-count of 0
    await expect(page.locator('[data-testid="history-panel"][data-history-count="0"]')).toBeVisible({ timeout: 5000 });

    // Should show empty state with the specific testid
    await expect(page.locator('[data-testid="history-empty-state"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.empty-title')).toHaveText('No History Yet');
  });

  test('should show entry count badge when history exists', async ({ page }) => {
    // Inject mock history entry via localStorage
    await page.evaluate(() => {
      const mockEntry = {
        id: 'test-1',
        timestamp: new Date().toISOString(),
        analysisType: 'detection',
        imageDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        results: { objects: [], inferenceTime: 100 },
        imageDimensions: { width: 100, height: 100 },
      };
      localStorage.setItem('ursa-history', JSON.stringify([mockEntry]));
    });

    // Reload to pick up the localStorage changes
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Badge should show 1
    const badge = page.locator('.toggle-badge');
    await expect(badge).toHaveText('1', { timeout: 10000 });
  });

  test('should display history entries in panel', async ({ page }) => {
    // Inject mock history entries
    await page.evaluate(() => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: new Date().toISOString(),
          analysisType: 'detection',
          imageDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          results: { objects: [{ class: 'person', score: 0.9, bbox: [0, 0, 50, 50] }], inferenceTime: 100 },
          imageDimensions: { width: 100, height: 100 },
        },
        {
          id: 'test-2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          analysisType: 'classification',
          imageDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          results: { predictions: [{ label: 'cat', confidence: 0.85 }], inferenceTime: 50 },
          imageDimensions: { width: 200, height: 150 },
        },
      ];
      localStorage.setItem('ursa-history', JSON.stringify(mockEntries));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open panel
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Wait for entry list to be visible with entries
    await expect(page.locator('[data-testid="history-entry-list"]')).toBeVisible({ timeout: 5000 });

    // Should show 2 entries
    const entries = page.locator('.entry-item');
    await expect(entries).toHaveCount(2, { timeout: 5000 });

    // First entry should show detection info
    await expect(page.locator('.entry-item').first().locator('.entry-summary')).toContainText('1 object detected');
  });

  test('should delete entry when delete button is clicked', async ({ page }) => {
    // Inject mock entry
    await page.evaluate(() => {
      const mockEntry = {
        id: 'test-1',
        timestamp: new Date().toISOString(),
        analysisType: 'detection',
        imageDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        results: { objects: [], inferenceTime: 100 },
        imageDimensions: { width: 100, height: 100 },
      };
      localStorage.setItem('ursa-history', JSON.stringify([mockEntry]));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Wait for entry to be visible
    await expect(page.locator('[data-testid="history-entry-list"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.entry-item')).toHaveCount(1);

    // Hover over entry to show delete button
    await page.locator('.entry-item').hover();

    // Click delete with force to ensure click goes through
    await page.locator('.entry-delete').click({ force: true });

    // Wait for entry count to become 0 via the data attribute
    await expect(page.locator('[data-testid="history-panel"][data-history-count="0"]')).toBeVisible({ timeout: 5000 });

    // Entry should be removed, show empty state
    await expect(page.locator('[data-testid="history-empty-state"]')).toBeVisible({ timeout: 5000 });
  });

  test('should clear all history when confirmed', async ({ page }) => {
    // Inject multiple mock entries
    await page.evaluate(() => {
      const entries = [1, 2, 3].map(i => ({
        id: `test-${i}`,
        timestamp: new Date().toISOString(),
        analysisType: 'detection',
        imageDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        results: { objects: [], inferenceTime: 100 },
        imageDimensions: { width: 100, height: 100 },
      }));
      localStorage.setItem('ursa-history', JSON.stringify(entries));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Wait for entries to load
    await expect(page.locator('[data-testid="history-panel"][data-history-count="3"]')).toBeVisible({ timeout: 5000 });

    // Click "Clear All History"
    await page.locator('.clear-all-button').click();

    // Confirm dialog should appear
    await expect(page.locator('.confirm-clear')).toBeVisible({ timeout: 5000 });

    // Confirm
    await page.locator('.confirm-yes').click();

    // Wait for entry count to become 0
    await expect(page.locator('[data-testid="history-panel"][data-history-count="0"]')).toBeVisible({ timeout: 5000 });

    // Should show empty state
    await expect(page.locator('[data-testid="history-empty-state"]')).toBeVisible({ timeout: 5000 });
  });
});
