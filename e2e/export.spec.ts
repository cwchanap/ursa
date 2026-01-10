import { test, expect, type Page } from '@playwright/test';

// Helper functions for test setup
function createMockHistoryEntry(overrides = {}): Record<string, unknown> {
  return {
    id: 'test-1',
    timestamp: new Date().toISOString(),
    analysisType: 'detection',
    imageDataURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGNzYAAIoaB/kfOlcAAAAASUVORK5CYII=',
    results: {
      objects: [{ class: 'person', score: 0.9, bbox: [0, 0, 50, 50] }],
      inferenceTime: 100,
    },
    imageDimensions: { width: 10, height: 10 },
    ...overrides,
  };
}

async function injectMockHistory(page: Page, entry: Record<string, unknown>) {
  await page.evaluate((mockEntry: Record<string, unknown>) => {
    const existing = JSON.parse(localStorage.getItem('ursa-history') || '[]');
    localStorage.setItem('ursa-history', JSON.stringify([mockEntry, ...existing]));
  }, entry);
}

test.describe('Export Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should show Export button when viewing history entry', async ({ page }) => {
    // Inject mock history entry
    await injectMockHistory(page, createMockHistoryEntry());

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open history panel
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });

    // Wait for entry list to be visible
    await expect(page.locator('[data-testid="history-entry-list"]')).toBeVisible({ timeout: 5000 });

    // Click on history entry to restore it
    const entryLocator = page.locator('.entry-item').first();
    await entryLocator.waitFor({ state: 'visible', timeout: 5000 });
    await entryLocator.click();

    // Wait for export panel to become ready (data-can-export="true")
    await expect(page.locator('[data-testid="export-panel"][data-can-export="true"]')).toBeVisible({
      timeout: 10000,
    });

    // Export button should be visible and enabled
    const exportButton = page.locator('[data-testid="export-button"]:not([disabled])');
    await expect(exportButton).toBeVisible({ timeout: 5000 });
  });

  test('should show dropdown menu when Export button is clicked', async ({ page }) => {
    // Inject mock history entry
    await injectMockHistory(page, createMockHistoryEntry());

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open history and click entry
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="history-entry-list"]')).toBeVisible({ timeout: 5000 });
    const entryLocator = page.locator('.entry-item').first();
    await entryLocator.waitFor({ state: 'visible', timeout: 5000 });
    await entryLocator.click();

    // Wait for export panel to become ready
    await expect(page.locator('[data-testid="export-panel"][data-can-export="true"]')).toBeVisible({
      timeout: 10000,
    });

    // Click export button (wait for it to be enabled)
    const exportButton = page.locator('[data-testid="export-button"]:not([disabled])');
    await expect(exportButton).toBeVisible({ timeout: 5000 });
    await exportButton.click();

    // Dropdown should appear
    const dropdown = page.locator('.export-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
  });

  test('should have export options in dropdown', async ({ page }) => {
    // Inject mock history entry
    await injectMockHistory(page, createMockHistoryEntry());

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open history and click entry
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="history-entry-list"]')).toBeVisible({ timeout: 5000 });
    const entryLocator = page.locator('.entry-item').first();
    await entryLocator.waitFor({ state: 'visible', timeout: 5000 });
    await entryLocator.click();

    // Wait for export panel to become ready
    await expect(page.locator('[data-testid="export-panel"][data-can-export="true"]')).toBeVisible({
      timeout: 10000,
    });

    // Click export button
    const exportButton = page.locator('[data-testid="export-button"]:not([disabled])');
    await expect(exportButton).toBeVisible({ timeout: 5000 });
    await exportButton.click();

    // Check for all export options
    await expect(page.locator('text=Download Image (PNG)')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Copy JSON to Clipboard')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Download JSON')).toBeVisible({ timeout: 5000 });
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    // Inject mock history entry with empty results
    await injectMockHistory(
      page,
      createMockHistoryEntry({
        results: { objects: [], inferenceTime: 100 },
      })
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open history and click entry
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="history-entry-list"]')).toBeVisible({ timeout: 5000 });
    const entryLocator = page.locator('.entry-item').first();
    await entryLocator.waitFor({ state: 'visible', timeout: 5000 });
    await entryLocator.click();

    // Wait for export panel to become ready
    await expect(page.locator('[data-testid="export-panel"][data-can-export="true"]')).toBeVisible({
      timeout: 10000,
    });

    // Click export button
    const exportButton = page.locator('[data-testid="export-button"]:not([disabled])');
    await expect(exportButton).toBeVisible({ timeout: 5000 });
    await exportButton.click();

    // Dropdown should be visible
    await expect(page.locator('.export-dropdown')).toBeVisible({ timeout: 5000 });

    // Click outside (on the page body)
    await page.mouse.click(10, 10);

    // Dropdown should close
    await expect(page.locator('.export-dropdown')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show feedback toast after copy action', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Inject mock history entry with empty results
    await injectMockHistory(
      page,
      createMockHistoryEntry({
        results: { objects: [], inferenceTime: 100 },
      })
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Open history and click entry
    await page.locator('.history-toggle').click();
    await expect(page.locator('.history-panel.open')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="history-entry-list"]')).toBeVisible({ timeout: 5000 });
    const entryLocator = page.locator('.entry-item').first();
    await entryLocator.waitFor({ state: 'visible', timeout: 5000 });
    await entryLocator.click();

    // Wait for export panel to become ready
    await expect(page.locator('[data-testid="export-panel"][data-can-export="true"]')).toBeVisible({
      timeout: 10000,
    });

    // Click export button
    const exportButton = page.locator('[data-testid="export-button"]:not([disabled])');
    await expect(exportButton).toBeVisible({ timeout: 5000 });
    await exportButton.click();

    // Click copy JSON
    await page.locator('text=Copy JSON to Clipboard').click();

    // Should show success toast
    await expect(page.locator('.feedback-toast.success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.feedback-toast')).toContainText('Copied to clipboard');
  });
});
