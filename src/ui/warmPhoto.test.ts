import { expect, test, vi } from 'vitest';
import { photoSources, warmPhoto } from './photos';

test('retains recent responsive pictures, bounds memory and retries failures', () => {
  const create = vi.spyOn(document, 'createElement');
  const photo = photoSources('test/10');
  warmPhoto(photo, '244px');
  const pictures = () => create.mock.results.filter(r => r.value instanceof HTMLPictureElement).map(r => r.value as HTMLPictureElement);
  expect(pictures()).toHaveLength(1);
  expect(pictures()[0]!.querySelector('source')!.srcset).toBe(photo.sources[0]!.srcSet);
  expect(pictures()[0]!.querySelector('img')!.sizes).toBe('244px');
  warmPhoto(photo, '244px');
  expect(pictures()).toHaveLength(1);
  pictures()[0]!.querySelector('img')!.dispatchEvent(new Event('error'));
  warmPhoto(photo, '244px');
  expect(pictures()).toHaveLength(2);
  for (let n = 1; n <= 8; n++) warmPhoto(photoSources(`test/${n}`), '244px');
  warmPhoto(photo, '244px');
  expect(pictures()).toHaveLength(11); // evicted after eight other profiles
  create.mockRestore();
});
