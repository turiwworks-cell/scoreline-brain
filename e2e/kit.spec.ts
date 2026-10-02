import { expect, test } from '@playwright/test';

test('dev kit renders every material', async ({ page }, info) => {
  await page.goto('/dev/kit');
  await expect(page.getByTestId('dev-kit')).toBeVisible();
  for (const name of ['Colours', 'Spectrum', 'Type scale', 'Glass', 'SoftLight', 'Hover light', 'Button', 'Pill', 'Tabs']) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/kit-${info.project.name}.png`, fullPage: true });
});

test('the hover light follows the pointer through custom properties', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('phone'), 'hover is desktop only');
  await page.goto('/dev/kit');
  const pad = page.getByTestId('hover-pad');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 40);
  await page.mouse.move(box.x + 80, box.y + 50);
  await expect.poll(() => pad.evaluate((el) => el.style.getPropertyValue('--mx'))).toBe('80px');
  await expect.poll(() => pad.evaluate((el) => getComputedStyle(el).getPropertyValue('--lit').trim())).toBe('1');
});
