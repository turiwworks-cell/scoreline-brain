/** `"#0055A4"`, `"0055A4"` or a number → `"#0055A4"`. */
export function colorOf(v: unknown, d: string): string {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff) {
    return `#${v.toString(16).padStart(6, '0').toUpperCase()}`;
  }
  if (typeof v === 'string') {
    const h = v.replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h.toUpperCase()}`;
  }
  return d;
}
