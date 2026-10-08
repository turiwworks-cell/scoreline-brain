import { expect, test } from '@playwright/test';

test('the supplied OFF art follows the normal Rive close and gives way on reopening', async ({ page }) => {
  await page.goto('/?demo');
  const live = page.getByRole('button', { name: /^Live,/ });
  await expect(live).toHaveAttribute('data-rive-live', 'true', { timeout: 15000 });
  await expect(live.locator('canvas')).toHaveCSS('opacity', '1');
  await live.click();
  await expect(live).toHaveAttribute('aria-pressed', 'false');
  await expect(live.locator('[data-live-off]')).toHaveCount(1);
  await expect(live.locator('canvas')).toHaveCSS('opacity', '0');
  const box = await live.boundingBox();
  expect(Math.abs(box!.width - 110)).toBeLessThan(0.1);
  expect(box!.height).toBe(40);
  await live.click();
  await expect(live.locator('[data-live-off]')).toHaveCount(0);
  await expect(live.locator('canvas')).toHaveCSS('opacity', '1');
  await live.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  await expect(live).toHaveAttribute('aria-pressed', 'true');
  await expect(live.locator('[data-live-off]')).toHaveCount(0);
});

test('Facts keeps the scorer photo and selected Squad controls do not restart the letter roll', async ({ page }) => {
  await page.goto('/match/1/facts?demo');
  const match = page.locator('[data-screen="match"][data-present="true"]');
  const goal = match.locator('[data-row="e"]').filter({ hasText: 'Mbappé' }).first();
  const photo = goal.locator('img').first();
  await expect(photo).toHaveAttribute('src', /\/fra\/10-bust/);
  await expect.poll(() => photo.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await page.goto('/match/11/lineup?demo');
  const squad = match.getByRole('tab', { name: 'Squad' });
  await expect(squad).toHaveAttribute('aria-selected', 'true');
  const result = await squad.evaluate(el => {
    let rolls = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<typeof animate>) {
      if (el.contains(this)) rolls++;
      return animate.apply(this, args);
    };
    const url = location.href;
    const historySize = history.length;
    try { for (let i = 0; i < 3; i++) (el as HTMLButtonElement).click(); }
    finally { Element.prototype.animate = animate; }
    return { rolls, sameURL: location.href === url, sameHistory: history.length === historySize };
  });
  expect(result).toEqual({ rolls: 0, sameURL: true, sameHistory: true });
});
