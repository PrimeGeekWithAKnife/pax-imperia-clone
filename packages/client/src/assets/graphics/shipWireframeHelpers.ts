export function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const e = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
  const n = parseInt(e, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
