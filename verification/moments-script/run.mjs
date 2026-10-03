/* global process, console */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../..');
const source = readFileSync(join(root, 'rive/moments.luau'), 'utf8');
const legacy = readFileSync(join(root, 'legacy/scoreline_11.luau'), 'utf8');
const normalize = s => s.replaceAll('Scoreline', 'Moments').replace(/\s+/g, ' ').trim();
for (const [name, next] of [['shoutWord', '-- a word of big letters'], ['slamWord', '-- the player rising']]) {
 const extract = s => s.slice(s.indexOf('local function ' + name), s.indexOf(next, s.indexOf('local function ' + name)));
 assert.equal(normalize(extract(source)), normalize(extract(legacy)), name + ' must preserve reference drawing');
}
const glyphs = [...source.matchAll(/^GLYPHS\.B\["(.)"\] = .*$/gm)].map(m => m[0]);
assert.equal(glyphs.length, 9);
for (const glyph of glyphs) assert.ok(legacy.includes(glyph), 'glyph differs from reference');
const dir = join(root, 'verification/moments-script/build/tests');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'rive.yaml'), 'name: moments-tests\nmain: moments_test\n');
const prefix = source.slice(0, source.lastIndexOf('return function(): Node<Moments>'));
writeFileSync(join(dir, 'moments_test.luau'), prefix + readFileSync(join(root, 'verification/moments-script/test-body.luau'), 'utf8'));
const native = join(root, 'verification/moments-script/build/native');
mkdirSync(native, { recursive: true });
writeFileSync(join(native, 'rive.yaml'), 'name: moments-native\n');
writeFileSync(join(native, 'moments.luau'), source);
writeFileSync(join(native, 'scene.rml'), readFileSync(join(root, 'verification/moments-script/scene.rml'), 'utf8'));
console.log('PASS: reference drawing and 9 exact glyphs');
if (process.argv.includes('--prepare-only')) process.exit(0);
const run = spawnSync(process.env.RIVE_CLI ?? 'rive', [dir, '--test', '--format=json'], { encoding: 'utf8' });
if (run.error) throw run.error;
process.stdout.write(run.stdout ?? '');
process.stderr.write(run.stderr ?? '');
assert.equal(run.status, 0, 'Rive Luau tests failed');
console.log('PASS: reference drawing + 9 exact glyphs + Rive Luau lifecycle tests');

