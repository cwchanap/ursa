import { test, expect } from '@playwright/test';

test.describe('Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Wait for app to fully load
    await page.waitForLoadState('networkidle');
  });

  test('should display FPS slider in detection controls', async ({ page }) => {
    // Look for FPS slider
    const fpsSlider = page.locator('#fps-slider');
    await expect(fpsSlider).toBeVisible({ timeout: 10000 });
  });

  test('should show default FPS value of 5', async ({ page }) => {
    // Check default FPS display
    const fpsValue = page.locator('.slider-value .value-number');
    await expect(fpsValue).toHaveText('5', { timeout: 10000 });
  });

  test('should update FPS value when slider is moved', async ({ page }) => {
    const fpsSlider = page.locator('#fps-slider');
    const fpsValue = page.locator('.slider-value .value-number');

    // Wait for slider to be visible
    await expect(fpsSlider).toBeVisible({ timeout: 10000 });

    // Use evaluate to set slider value directly (more reliable than fill for range inputs)
    await fpsSlider.evaluate((el: HTMLInputElement) => {
      el.value = '10';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Verify displayed value changed
    await expect(fpsValue).toHaveText('10', { timeout: 5000 });
  });

  test('should persist FPS setting after page reload', async ({ page }) => {
    const fpsSlider = page.locator('#fps-slider');

    // Wait for slider
    await expect(fpsSlider).toBeVisible({ timeout: 10000 });

    // Set FPS to 12
    await fpsSlider.evaluate((el: HTMLInputElement) => {
      el.value = '12';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Wait for debounced save (500ms + buffer)
    await page.waitForTimeout(800);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify FPS is still 12
    const fpsValue = page.locator('.slider-value .value-number');
    await expect(fpsValue).toHaveText('12', { timeout: 10000 });
  });

  test('should show quality label based on FPS value', async ({ page }) => {
    const fpsSlider = page.locator('#fps-slider');
    const qualityLabel = page.locator('.fps-quality-label');

    await expect(fpsSlider).toBeVisible({ timeout: 10000 });

    // Test Battery Saver (1-3 FPS)
    await fpsSlider.evaluate((el: HTMLInputElement) => {
      el.value = '2';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(qualityLabel).toHaveText('Battery Saver', { timeout: 5000 });

    // Test Balanced (4-7 FPS)
    await fpsSlider.evaluate((el: HTMLInputElement) => {
      el.value = '5';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(qualityLabel).toHaveText('Balanced', { timeout: 5000 });

    // Test Smooth (8-10 FPS)
    await fpsSlider.evaluate((el: HTMLInputElement) => {
      el.value = '9';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(qualityLabel).toHaveText('Smooth', { timeout: 5000 });

    // Test High Performance (11+ FPS)
    await fpsSlider.evaluate((el: HTMLInputElement) => {
      el.value = '14';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(qualityLabel).toHaveText('High Performance', { timeout: 5000 });
  });

  test('should persist confidence threshold setting', async ({ page }) => {
    const confidenceSlider = page.locator('#confidence-slider');

    await expect(confidenceSlider).toBeVisible({ timeout: 10000 });

    // Set confidence to 75
    await confidenceSlider.evaluate((el: HTMLInputElement) => {
      el.value = '75';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Wait for debounced save
    await page.waitForTimeout(800);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify confidence is still 75
    await expect(confidenceSlider).toHaveValue('75', { timeout: 10000 });
  });
});
