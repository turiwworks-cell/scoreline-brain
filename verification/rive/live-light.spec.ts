import { expect, test, type Page } from '@playwright/test';

/*
 * The Live button in the app: Rive draws the capsule, the DOM lays the hover light over it. The
 * light's box must ride the art's capsule through both timelines (its rim drew a second capsule
 * beside the art's when it ran a transition of its own), and the art must be drawn at the screen's
 * real pixels when window.devicePixelRatio says otherwise (a phone emulated on a desktop).
 *
 * The first test also prints the capsule's open fraction frame by frame (LIVE_TRACK), the numbers
 * behind LIVE_OPENING and LIVE_CLOSING in src/rive/liveLight.ts.
 */

type Frame = { t: number; art: number; light: number };

const ready = async (page: Page) => {
  await page.goto('/?demo');
  const button = page.getByRole('button', { name: /^Live, / });
  await expect(button).toHaveAttribute('data-rive-live', 'true', { timeout: 30000 });
  // the art's first timeline has played
  await page.waitForTimeout(1500);
  return button;
};

/** Clicks the button and, every frame for `ms`, reads the art capsule's left edge from the canvas and the light's. */
const toggle = (page: Page, ms: number) => page.evaluate((ms) => new Promise<Frame[]>((resolve) => {
  const button = document.querySelector<HTMLButtonElement>('button[data-rive-live]')!;
  const canvas = button.querySelector('canvas')!;
  const light = button.querySelector<HTMLElement>('.m-light')!;
  const row = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const edge = () => {
    const w = canvas.width;
    row.canvas.width = w; row.canvas.height = 1;
    row.drawImage(canvas, 0, Math.round(canvas.height / 2), w, 1, 0, 0, w, 1);
    const a = row.getImageData(0, 0, w, 1).data;
    const first = Array.from({ length: w }, (_, x) => a[x * 4 + 3]!).findIndex((v) => v > 0);
    // sub-pixel: the edge is where the partly covered pixels' coverage adds up to one
    let x = first, partial = 0;
    while (x < w && a[x * 4 + 3]! < 250) { partial += a[x * 4 + 3]! / 255; x++; }
    const box = canvas.getBoundingClientRect();
    return box.left + (x - partial) * box.width / w;
  };
  const frames: Frame[] = [];
  let start = 0;
  button.click();
  const step = (now: number) => {
    start ||= now;
    frames.push({ t: Math.round(now - start), art: edge(), light: light.getBoundingClientRect().left });
    if (now - start < ms) requestAnimationFrame(step); else resolve(frames);
  };
  requestAnimationFrame(step);
}), ms);

test('the Live hover light rides the art capsule through both toggles', async ({ page }, testInfo) => {
  const button = await ready(page);
  const box = (await button.boundingBox())!;
  // hover where both capsules are: the light is on, as a pointer resting on the button
  await page.mouse.move(box.x + box.width - 24, box.y + box.height / 2);
  const button0 = await button.evaluate((el) => el.getBoundingClientRect().left);
  const capsule = await button.evaluate((el) => {
    const s = el.querySelector<HTMLElement>('.m-light')!.style;
    return { on: parseFloat(s.getPropertyValue('--cap-on')), off: parseFloat(s.getPropertyValue('--cap-off')) };
  });
  for (const [name, live] of [['opening', 'true'], ['closing', 'false']] as const) {
    const frames = await toggle(page, 1000);
    await expect(button).toHaveAttribute('aria-pressed', live);
    const right = button0 + capsule.on;
    const open = (x: number) => +((right - x - capsule.off) / (capsule.on - capsule.off)).toFixed(4);
    console.log('LIVE_TRACK ' + name + ' ' + JSON.stringify(frames.map((f) => [f.t, open(f.art)])));
    const gaps = frames.map((f) => Math.abs(f.light - f.art));
    const worst = Math.max(...gaps);
    console.log('LIVE_LIGHT ' + JSON.stringify({ project: testInfo.project.name, name, frames: frames.length, worstGapPx: +worst.toFixed(2), meanGapPx: +(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2) }));
    // A frame's step at full speed is several px; the light is never a frame behind or ahead.
    expect(worst).toBeLessThan(3);
    // and it settles exactly where the art does
    expect(gaps.at(-1)!).toBeLessThan(0.75);
    await page.waitForTimeout(400);
  }
});

test('the Live art is drawn at the screen\'s pixels when devicePixelRatio reports fewer', async ({ playwright }, testInfo) => {
  // A phone emulated on a desktop (Firefox's responsive design mode): the page is drawn at the
  // screen's 3 device pixels per CSS pixel, but window.devicePixelRatio reports the phone's 1.
  // (Chromium's own device emulation would not do: its device-pixel box ignores the emulated ratio.)
  const launch = testInfo.project.use.launchOptions ?? {};
  const browser = await playwright.chromium.launch({ ...launch, args: [...(launch.args ?? []), '--force-device-scale-factor=3'] });
  const page = await (await browser.newContext({ viewport: null, baseURL: testInfo.project.use.baseURL })).newPage();
  await page.addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { get: () => 1, configurable: true }));
  const button = await ready(page);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  const surface = await button.evaluate((el) => {
    const canvas = el.querySelector('canvas')!;
    return { width: canvas.width, height: canvas.height, css: canvas.getBoundingClientRect().width };
  });
  console.log('LIVE_SURFACE ' + JSON.stringify({ project: testInfo.project.name, ...surface }));
  expect(Math.abs(surface.width - surface.css * 3)).toBeLessThanOrEqual(1);
  await button.screenshot({ path: `test-results/live-surface-${testInfo.project.name}.png` });
  await browser.close();
});
