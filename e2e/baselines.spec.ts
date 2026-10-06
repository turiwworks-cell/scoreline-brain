import { expect, test, type Page } from '@playwright/test';
import { baselines, bc, offsets } from './support/baseline';

/*
 * Issue #10: the ported text sits on the Lua's baselines (txt/lab y, or bc(cy, size)), within 1.1 px
 * (the browser's whole-pixel font metrics; e2e/support/baseline.ts). The Lua line each check comes
 * from is beside it. The moments' toast and scene lines are checked in verification/moments.
 */

const TOL = 1.1;
const L = '[data-screen="list"][data-present="true"] ';
const M = '[data-screen="match"][data-present="true"] ';

async function ready(page: Page, url: string) {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
}

function within(rows: Array<Record<string, number | null>>) {
  const all = offsets(rows);
  expect(all.length).toBeGreaterThan(0);
  for (const [sel, d] of all) {
    expect(d, `${sel} not found`).not.toBeNull();
    expect(Math.abs(d!), `${sel}: ${d} px from the Lua's baseline`).toBeLessThanOrEqual(TOL);
  }
}

test('list: rows and group labels', async ({ page }) => {
  await ready(page, '/?demo');
  // drawRow, luau:3932-3963: the time on cy = y + 37.5; names and scores on y + 23
  within(await baselines(page, L + 'button[data-focus-key^="match-"]', [['[class*="_time_"]', bc(37.5, 12)], ['[class*="_teamName_"]', bc(23, 15)], ['[class*="_ink_"]', bc(23, 17)]]));
  // drawGroup, luau:4003-4006: the labels on y + 10.5
  within(await baselines(page, L + '[data-group] > [class*="_head_"]', [['[class*="_name_"]', 10.5], ['[class*="_num_"]', 10.5]]));
});

test('list: the live cards', async ({ page }) => {
  // Begin on Today so the click below opens Live; Live is now the default URL state.
  await ready(page, '/?demo&live=0');
  await page.locator(L + 'button[aria-pressed]').first().click();
  await page.waitForTimeout(1500);
  // drawCards, luau:3797-3841, at the 70 px card: pad 8, crest 14, rows on 15 and 34
  const rows = await baselines(page, L + 'section[aria-label="Live now"] button', [
    ['[class*="_name_"]', bc(15, 10.5)],
    ['[class*="_ink_"]', bc(15, 13)],
  ]);
  within(rows);
});

test('match: hero, Stats, Table', async ({ page }) => {
  await ready(page, '/match/1/stats?demo');
  // stats, luau:5337-5370: the possession's baseline (y + 32 + 46.4) is 63.87 below the team names' (bc(y + 10, 13))
  const [poss] = await baselines(page, M + '[class*="_stats_"]', [['[class*="_nameHome_"]', 0], ['[class*="_possNum_"]', 0]], { rows: 1 });
  expect(Math.abs(poss!['[class*="_possNum_"]']! - poss!['[class*="_nameHome_"]']! - 63.87)).toBeLessThanOrEqual(TOL);
  // each stat on its row's y + 29, the label half a pixel above
  within(await baselines(page, M + '[class*="_statRow_"]', [['[data-side="home"]', 29], ['[class*="_statName_"]', 28.5]]));
  await page.getByRole('tab', { name: 'Table', exact: true }).first().click();
  await page.waitForTimeout(1500);
  // standingsView, luau:5733-5755: rows 46 tall, everything on cy = y + 23
  within(
    await baselines(page, M + '[role="row"][data-team]', [
      ['[class*="_name_"]', bc(23, 15)],
      ['[class*="_p_"]', bc(23, 14)],
      ['[class*="_wdl_"]', bc(23, 13)],
      ['[class*="_gd_"]', bc(23, 14)],
      ['[class*="_pts_"]', bc(23, 15)],
    ]),
  );
});

test('match: the line-up plates and the squad', async ({ page }) => {
  await ready(page, '/match/1/lineup?demo');
  // pitchMarker, luau:5432-5433: the name on bc(py, its fitted size), py the plate's centre (20 tall)
  within(await baselines(page, M + '[data-pitch] [data-player]', [['[class*="_pname_"]', 10, 'bc']], { origin: '[class*="_plate_"]', rows: 11 }));
  // playerRow, luau:5512-5522: cy = y + 32
  within(await baselines(page, M + 'button[class*="_row_"][data-player]', [['[class*="_rowFull_"]', bc(24, 15)], ['[class*="_rowRole_"]', bc(43, 12)]]));
});

test('desktop: the Leaders rows', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('desktop'), 'the Insights pane is the desktop’s');
  await ready(page, '/match/1/facts?demo');
  await page.getByRole('tablist', { name: 'Insights' }).getByRole('tab', { name: 'Leaders' }).click();
  await page.waitForTimeout(1500);
  // leaderRow, luau:6924-6934: cy = y + 32
  within(await baselines(page, '[data-insight-leader]', [['[class*="_rank_"]', bc(32, 13)], ['[class*="_leaderName_"]', bc(24, 15)], ['[class*="_opponent_"]', bc(43, 12)]]));
  // goalRow, luau:6964-6973: cy = y + 26
  within(await baselines(page, '[data-insight-goal]', [['[class*="_minute_"]', bc(26, 13)], ['[class*="_goalName_"]', bc(19, 14)], ['[class*="_fixture_"]', bc(37, 11.5)]]));
});
