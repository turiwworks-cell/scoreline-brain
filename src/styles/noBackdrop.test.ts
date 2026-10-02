import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// ARCHITECTURE §7: glass is an opaque pane, never a backdrop blur.
const banned = ['backdrop', 'filter'].join('-');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

test(`no ${banned} anywhere in src/`, () => {
  const hits = files(join(__dirname, '..')).filter((f) => readFileSync(f, 'utf8').includes(banned));
  expect(hits).toEqual([]);
});
