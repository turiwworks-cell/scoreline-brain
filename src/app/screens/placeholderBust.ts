import { mix, pastel } from '../../ui';

/*
 * A stand-in player image until the image pipeline (Part 8) lands: a plain silhouette in the
 * team's colours, at the pipeline's bust size (288 × 360, CROP.bust) so the face crop of
 * PlayerPhoto / PhotoTile (60, 8, 168 × 168) frames the head the way it will frame a real photo.
 */

const cache = new Map<string, string>();

export function placeholderBust(team: { id: string; colors: readonly [string, string] }): string {
  const hit = cache.get(team.id);
  if (hit) return hit;
  const [c1, c2] = team.colors;
  const shirt = mix('#141414', c1, 0.8);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="360" viewBox="0 0 288 360">` +
    `<path d="M18 360 C24 250 70 214 144 210 C218 214 264 250 270 360 Z" fill="${shirt}"/>` +
    `<path d="M120 168 H168 V214 C156 226 132 226 120 214 Z" fill="#5c5b58"/>` +
    `<ellipse cx="144" cy="104" rx="52" ry="64" fill="#6f6e6a"/>` +
    `<path d="M116 212 L144 244 L172 212" fill="none" stroke="${pastel(c2)}" stroke-width="7" stroke-linejoin="round"/>` +
    `</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(team.id, url);
  return url;
}
