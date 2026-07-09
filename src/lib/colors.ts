import * as THREE from 'three';

export type ColorMode = 'arm' | 'gap' | 'sequence';
export type Theme = 'light' | 'dark';

export type HighlightSpec =
  | { type: 'none' }
  | { type: 'twins' }
  | { type: 'fibonacci' }
  | { type: 'residue'; q: number; a: number }
  | { type: 'arm'; armIndex: number; stepsPerRotation: number };

// Fills `out` (1 float/point) with 1.0 for lit points and 0.0 for dimmed ones.
// Selection/filter changes only touch this array — never colors or geometry.
export const computeDim = (primes: number[], spec: HighlightSpec, out: Float32Array): void => {
  const n = primes.length;
  if (spec.type === 'none') {
    out.fill(1);
    return;
  }
  if (spec.type === 'twins') {
    for (let i = 0; i < n; i++) {
      const twinNext = i < n - 1 && primes[i + 1] - primes[i] === 2;
      const twinPrev = i > 0 && primes[i] - primes[i - 1] === 2;
      out[i] = twinNext || twinPrev ? 1 : 0;
    }
    return;
  }
  if (spec.type === 'fibonacci') {
    // Fibonacci primes are genuinely rare: only 2, 3, 5, 13, 89, 233, 1597,
    // 28657, 514229 below the 100k-th prime
    const fib = new Set<number>();
    for (let a = 1, b = 2; a <= primes[n - 1]; [a, b] = [b, a + b]) fib.add(a);
    for (let i = 0; i < n; i++) out[i] = fib.has(primes[i]) ? 1 : 0;
    return;
  }
  if (spec.type === 'residue') {
    for (let i = 0; i < n; i++) out[i] = primes[i] % spec.q === spec.a ? 1 : 0;
    return;
  }
  for (let i = 0; i < n; i++) out[i] = i % spec.stepsPerRotation === spec.armIndex ? 1 : 0;
};

// All colors are authored as display-sRGB HSL and converted to the linear
// working color space (the SRGBColorSpace argument), so both the raw Points
// shader (which ends with colorspace_fragment) and the built-in line
// materials render them identically.

export const armColor = (armIndex: number, stepsPerRotation: number, theme: Theme): THREE.Color => {
  const hue = (armIndex % stepsPerRotation) / stepsPerRotation;
  return new THREE.Color().setHSL(hue, 0.85, theme === 'dark' ? 0.62 : 0.45, THREE.SRGBColorSpace);
};

// Fills `out` (length 3n, linear RGB) in place — cycling color modes or
// changing angleDelta never rebuilds geometry.
export const computeColors = (
  primes: number[],
  mode: ColorMode,
  angleDelta: number,
  theme: Theme,
  out: Float32Array
): void => {
  const n = primes.length;
  if (n === 0) return;
  const dark = theme === 'dark';
  const c = new THREE.Color();

  if (mode === 'arm') {
    const N = Math.round(360 / angleDelta);
    const l = dark ? 0.62 : 0.45;
    for (let i = 0; i < n; i++) {
      c.setHSL((i % N) / N, 0.85, l, THREE.SRGBColorSpace);
      out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
    }
    return;
  }

  if (mode === 'gap') {
    // Log-normalized gap to the next prime: cyan (tight) -> ember (wide),
    // twin primes (gap 2) override to gold so they pop
    let maxGap = 4;
    for (let i = 0; i < n - 1; i++) maxGap = Math.max(maxGap, primes[i + 1] - primes[i]);
    const denom = Math.log2(maxGap / 2);
    for (let i = 0; i < n; i++) {
      // last prime has no forward gap; reuse the previous one
      const gap = i < n - 1 ? primes[i + 1] - primes[i] : primes[i] - primes[i - 1];
      if (gap === 2) {
        c.setHSL(0.12, 1.0, dark ? 0.75 : 0.5, THREE.SRGBColorSpace);
      } else {
        const t = Math.min(1, Math.log2(Math.max(gap, 2) / 2) / denom);
        c.setHSL(0.58 - 0.5 * t, 0.8, dark ? 0.6 : 0.44, THREE.SRGBColorSpace);
      }
      out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
    }
    return;
  }

  // sequence: violet -> amber along the spiral
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    c.setHSL(0.72 - 0.6 * t, 0.8, dark ? 0.62 : 0.46, THREE.SRGBColorSpace);
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
};

// ---- CSS-side mirrors of the same HSL formulas, for the on-screen legend ----
// (single source of truth: these must stay in sync with computeColors above)

const cssHsl = (h: number, s: number, l: number): string =>
  `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

export const legendStops = (mode: ColorMode, theme: Theme): string[] => {
  const dark = theme === 'dark';
  const stops: string[] = [];
  const n = 12;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    if (mode === 'arm') stops.push(cssHsl(k / n, 0.85, dark ? 0.62 : 0.45));
    else if (mode === 'gap') stops.push(cssHsl(0.58 - 0.5 * t, 0.8, dark ? 0.6 : 0.44));
    else stops.push(cssHsl(0.72 - 0.6 * t, 0.8, dark ? 0.62 : 0.46));
  }
  return stops;
};

export const twinCssColor = (theme: Theme): string => cssHsl(0.12, 1.0, theme === 'dark' ? 0.75 : 0.5);
