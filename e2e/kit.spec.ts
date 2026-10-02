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

test('a glass pane nested in a tinted pane keeps the plain glass colour', async ({ page }) => {
  await page.goto('/dev/kit');
  const bg = (id: string) =>
    // the last background layer is the pane colour
    page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg('tinted-card')).toBe('rgb(11, 43, 29)');
  const plain = await page.locator('.m-glass:not([style*="--glass-tint"])').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  // same colour as a pane that sits in no tinted pane, and not the parent's tint
  expect(await bg('nested-pill')).toBe(plain);
  expect(plain).not.toBe('rgb(11, 43, 29)');
});
