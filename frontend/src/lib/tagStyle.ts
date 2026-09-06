// Deterministic (same tag name -> same color) pill colors, since tags are user-defined with no fixed list.
const TAG_COLORS = [
  'bg-indigo-50 text-indigo-700',
  'bg-sky-50 text-sky-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-orange-50 text-orange-700',
  'bg-teal-50 text-teal-700',
];

// Decorative cover-band gradients, keyed the same way — stands in for a real event photo.
const COVER_GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-400',
  'from-amber-400 to-orange-500',
  'from-emerald-500 to-teal-400',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-fuchsia-500',
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function tagPillClass(tag: string): string {
  return TAG_COLORS[hash(tag) % TAG_COLORS.length];
}

export function coverGradientClass(seed: string): string {
  return COVER_GRADIENTS[hash(seed) % COVER_GRADIENTS.length];
}
