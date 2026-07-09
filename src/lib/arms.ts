import { makeArmPredictor, makePredictor } from './prediction';

// Spiral-arm math, extracted from the visualization component: residue-class
// arm detection, hybrid prediction, accuracy scoring, and the layout mappers.

export type Layout = 'classic' | 'residual' | 'helix' | 'pi' | 'vogel' | 'ulam' | 'custom';

// Layouts whose positions depend only on the prime's VALUE (angle/index play no
// role) — arm curves, the model curve, and index-residue highlights are
// spatially meaningless in these
export const VALUE_LAYOUTS: ReadonlySet<Layout> = new Set(['pi', 'vogel', 'ulam']);

export interface ArmPoint {
  prime: number;
  index: number;
}

export interface SpiralArm {
  armIndex: number; // The residue class (0 to stepsPerRotation-1)
  points: ArmPoint[];
  predictions: ArmPoint[]; // future points on the arm, prime = predicted value
}

export interface PredictionAccuracy {
  totalPredictions: number;
  correctPredictions: number;
  averageErrorPct: number;
  accuracy: number;
}

export const EMPTY_ACCURACY: PredictionAccuracy = {
  totalPredictions: 0,
  correctPredictions: 0,
  averageErrorPct: 0,
  accuracy: 0,
};

// ---- Arm structure ----
//
// An arm is a residue class of indices mod N: points k, k+N, k+2N… Its shape is
// set by how close N·Δ lands to a whole number of turns; the leftover is the
// per-step drift, and the arm precesses by that much as it grows outward.
//
// Rounding 360/Δ picks a bad N whenever Δ doesn't divide 360 — at 37.2° it gives
// N=10, which overshoots by 12° per step, so the "arm" coils around the origin
// instead of radiating out. But arms exist at EVERY angle: the good N are the
// denominators of the continued-fraction convergents of Δ/360, i.e. the best
// rational approximations. At 37.2° those are 9, 10, 29, 300 with drifts −25.2°,
// 12°, −1.2°, 0° — N=29 is the structure the eye actually picks out. At the
// golden angle they are the Fibonacci numbers, which is why a sunflower shows
// 34/55/89 spirals.
//
// Integer math on the entered angle (at most 3 decimals) keeps this exact.
const ANGLE_SCALE = 1000;
const FULL_TURN = 360 * ANGLE_SCALE;

// Fewer points than this and an arm doesn't read as one
const MIN_POINTS_PER_ARM = 3;

export interface ArmStructure {
  period: number; // N — indices N apart share an arm
  driftDeg: number; // signed precession per step; 0 means an exact ray
}

// Denominators of the continued-fraction convergents of n/d, increasing.
// Recurrence: q₋₂ = 1, q₋₁ = 0, qₖ = aₖ·qₖ₋₁ + qₖ₋₂
const convergentDenominators = (n: number, d: number): number[] => {
  const denominators: number[] = [];
  let qPrev2 = 1;
  let qPrev1 = 0;
  let num = n;
  let den = d;
  while (den !== 0) {
    const a = Math.floor(num / den);
    [num, den] = [den, num - a * den];
    const q = a * qPrev1 + qPrev2;
    qPrev2 = qPrev1;
    qPrev1 = q;
    denominators.push(q);
  }
  return denominators;
};

// Signed drift of a period-N arm, in degrees, within (−180, 180]
const driftDegrees = (period: number, n: number): number => {
  let r = (period * n) % FULL_TURN;
  if (r > FULL_TURN / 2) r -= FULL_TURN;
  return r / ANGLE_SCALE;
};

// The original rule: assume 360/Δ arms and ignore the remainder. Correct only
// when Δ divides 360 evenly; otherwise the arms precess by driftDeg per step.
// Kept so the two detectors can be compared side by side.
export const legacyArmStructure = (angleDelta: number): ArmStructure => {
  const n = Math.round(angleDelta * ANGLE_SCALE);
  const period = Math.max(1, Math.round(360 / angleDelta));
  return { period, driftDeg: driftDegrees(period, n) };
};

// The tightest arm structure this many primes can actually show: the largest
// convergent denominator (best approximation ⇒ least drift) that still leaves
// MIN_POINTS_PER_ARM points per arm. Null when even the coarsest doesn't fit.
export const armStructure = (angleDelta: number, primeCount: number, legacy = false): ArmStructure | null => {
  const n = Math.round(angleDelta * ANGLE_SCALE);
  if (n <= 0) return null;
  if (legacy) return legacyArmStructure(angleDelta);

  const maxPeriod = Math.floor(primeCount / MIN_POINTS_PER_ARM);

  let period: number | null = null;
  for (const q of convergentDenominators(n, FULL_TURN)) {
    if (q >= 2 && q <= maxPeriod) period = q; // later convergents approximate better
  }
  return period === null ? null : { period, driftDeg: driftDegrees(period, n) };
};

// Maps a (index, prime) pair to scene coordinates for the active layout.
// Index may be fractional (used to sample smooth curves between points).
export type MapFn = (index: number, prime: number, out: Float32Array | number[], offset: number) => void;

// ---- User-editable formula layout ----

export interface CustomFormulas {
  r: string; // radius,   e.g. "0.45*sqrt(p)"
  theta: string; // radians, e.g. "p*GOLDEN"
  z: string; // height,   e.g. "0"
}

export const DEFAULT_CUSTOM: CustomFormulas = { r: '0.01*p', theta: 'i*0.628', z: '0' };

export const CUSTOM_PRESETS: { label: string; formulas: CustomFormulas }[] = [
  { label: 'φ disc', formulas: { r: '0.45*sqrt(p)', theta: 'p*GOLDEN', z: '0' } },
  { label: 'π spiral', formulas: { r: '0.01*p', theta: 'p', z: '0' } },
  { label: 'fib waves', formulas: { r: '0.01*p', theta: 'i*0.628', z: '2*sin(i/fib(10))' } },
  { label: '√ fan', formulas: { r: '0.4*sqrt(p)', theta: 'sqrt(p)*TAU', z: '0' } },
];

const PHI = (1 + Math.sqrt(5)) / 2;
const FIB_CACHE = [1, 1];
const fibN = (k: number): number => {
  const j = Math.min(90, Math.max(0, Math.round(k)));
  while (FIB_CACHE.length <= j) FIB_CACHE.push(FIB_CACHE[FIB_CACHE.length - 1] + FIB_CACHE[FIB_CACHE.length - 2]);
  return FIB_CACHE[j];
};

export type FormulaFn = (p: number, i: number, n: number) => number;

// Compiles a user expression of p (prime), i (index), n (count) with Math and
// the constants PI/TAU/PHI/GOLDEN and fib(k) in scope. Returns null when it
// doesn't parse or doesn't produce a finite number — callers fall back and
// surface the error. new Function on the user's own input, in their own
// browser, crossing no trust boundary.
export const compileFormula = (expr: string): FormulaFn | null => {
  try {
    const fn = new Function(
      'p',
      'i',
      'n',
      'PHI',
      'GOLDEN',
      'TAU',
      'fib',
      `"use strict";
       const {sqrt, cbrt, abs, log, log2, log10, sin, cos, tan, atan, atan2, pow, exp, floor, ceil, round, min, max, sign, PI, E} = Math;
       return (${expr});`
    ) as (p: number, i: number, n: number, PHI: number, GOLDEN: number, TAU: number, fib: (k: number) => number) => number;
    const probe = fn(7, 3, 100, PHI, GOLDEN_ANGLE, 2 * Math.PI, fibN);
    if (!Number.isFinite(probe)) return null;
    return (p, i, n) => {
      const v = fn(p, i, n, PHI, GOLDEN_ANGLE, 2 * Math.PI, fibN);
      return Number.isFinite(v) ? v : 0;
    };
  } catch {
    return null;
  }
};

// ponytail: fixed residual gain — expose a slider if tuning ever matters
const RESIDUAL_GAIN = 50;

// Golden angle ≈ 2.39996 rad = 137.5078° — the "most irrational" rotation
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const VOGEL_SCALE = 0.45; // matches the classic view size at 300 primes
const ULAM_CELL = 0.2;

// Position of integer n (1-based) on the standard square Ulam spiral.
// Verified: 1→(0,0), 2→(1,0), 3→(1,1), 4→(0,1), ..., 10→(2,−1), 13→(2,2), 25→(2,−2)
const ulamCoords = (n: number): [number, number] => {
  if (n <= 1) return [0, 0];
  const k = Math.ceil((Math.sqrt(n) - 1) / 2); // ring index (ceil essential: round fails at perfect squares)
  let t = 2 * k + 1; // ring side length
  let m = t * t; // ring max (bottom-right corner)
  t -= 1;
  if (n >= m - t) return [k - (m - n), -k]; // bottom edge
  m -= t;
  if (n >= m - t) return [-k, -k + (m - n)]; // left edge
  m -= t;
  if (n >= m - t) return [-k + (m - n), k]; // top edge
  return [k, k - (m - n - t)]; // right edge
};

// Furthest world-space radius a layout reaches — drives camera range
export const layoutExtent = (layout: Layout, pLast: number): number => {
  switch (layout) {
    case 'helix':
      return 6 * Math.log(pLast);
    case 'vogel':
      return VOGEL_SCALE * Math.sqrt(pLast);
    case 'ulam':
      return ULAM_CELL * (Math.sqrt(pLast) / 2 + 1);
    default: // classic, residual, pi share the 0.01·p radial scale
      return 0.01 * pLast;
  }
};

export const makeMapper = (
  primes: number[],
  angleDelta: number,
  layout: Layout,
  custom?: CustomFormulas
): MapFn => {
  const rad = (angleDelta * Math.PI) / 180;

  if (layout === 'custom' && custom) {
    const rFn = compileFormula(custom.r);
    const thetaFn = compileFormula(custom.theta);
    const zFn = compileFormula(custom.z);
    if (rFn && thetaFn && zFn) {
      const n = primes.length;
      return (i, p, out, o) => {
        const r = rFn(p, i, n);
        const a = thetaFn(p, i, n);
        out[o] = r * Math.cos(a);
        out[o + 1] = r * Math.sin(a);
        out[o + 2] = zFn(p, i, n);
      };
    }
    // invalid formula: fall through to the classic mapper below
  }

  if (layout === 'pi') {
    // The 3Blue1Brown spiral: angle = the prime itself, in radians. Rational
    // approximations of 2π (44/7, 710/113) create spiral/ray structure at
    // different zoom levels.
    return (i, p, out, o) => {
      const r = 0.01 * p;
      out[o] = r * Math.cos(p);
      out[o + 1] = r * Math.sin(p);
      out[o + 2] = 0;
    };
  }

  if (layout === 'vogel') {
    // Phyllotaxis: each prime placed as sunflower seed #p. Integers would tile
    // the disc uniformly; the primes' clusters and voids are the signal.
    return (i, p, out, o) => {
      const r = VOGEL_SCALE * Math.sqrt(p);
      const a = p * GOLDEN_ANGLE;
      out[o] = r * Math.cos(a);
      out[o + 1] = r * Math.sin(a);
      out[o + 2] = 0;
    };
  }

  if (layout === 'ulam') {
    // Classic Ulam square spiral — quadratic-polynomial diagonals emerge
    return (i, p, out, o) => {
      const [ux, uy] = ulamCoords(Math.max(1, Math.round(p)));
      out[o] = ux * ULAM_CELL;
      out[o + 1] = uy * ULAM_CELL;
      out[o + 2] = 0;
    };
  }

  if (layout === 'residual' && primes.length > 0) {
    // Radius follows the SMOOTH anchored inverse-R curve (a pure function of the
    // index), so predicted positions are exact by construction; the unpredictable
    // part — the prime's deviation from the curve — becomes the z axis.
    const smooth = makePredictor(primes);
    const cache = new Float64Array(primes.length);
    for (let i = 0; i < primes.length; i++) cache[i] = smooth(i);
    return (i, p, out, o) => {
      const s = Number.isInteger(i) && i < cache.length ? cache[i] : smooth(i);
      const r = 0.01 * s;
      const a = i * rad;
      out[o] = r * Math.cos(a);
      out[o + 1] = r * Math.sin(a);
      out[o + 2] = RESIDUAL_GAIN * (p / s - 1);
    };
  }

  if (layout === 'helix' && primes.length > 0) {
    // Index as height, log radius: arms become helical strands and far
    // predictions stay on screen
    const maxR = 1.5 * Math.log(primes[primes.length - 1]);
    const zStep = (4 * maxR) / Math.max(primes.length, 1);
    return (i, p, out, o) => {
      const r = 1.5 * Math.log(p);
      const a = i * rad;
      out[o] = r * Math.cos(a);
      out[o + 1] = r * Math.sin(a);
      out[o + 2] = zStep * i;
    };
  }

  return (i, p, out, o) => {
    const r = 0.01 * p;
    const a = i * rad;
    out[o] = r * Math.cos(a);
    out[o + 1] = r * Math.sin(a);
    out[o + 2] = 0;
  };
};

// Predict the next points along a spiral arm. The arm's future indices are
// known exactly (index + k·stepsPerRotation); only the prime's magnitude needs
// predicting — `predict` is the hybrid model: globally anchored inverse
// Riemann-R plus this arm's own shrunken offset (see src/lib/prediction.ts).
const predictArmExtension = (
  points: ArmPoint[],
  stepsPerRotation: number,
  numPredictions: number,
  predict: (j: number) => number
): ArmPoint[] => {
  if (points.length < 2) return [];

  const lastPoint = points[points.length - 1];
  const predictions: ArmPoint[] = [];
  for (let step = 1; step <= numPredictions; step++) {
    const index = lastPoint.index + step * stepsPerRotation;
    predictions.push({ index, prime: Math.round(predict(index)) });
  }
  return predictions;
};

// Detect spiral arms using RESIDUE CLASS grouping: arms are formed by primes
// at indices k, k+N, k+2N, ... where N = stepsPerRotation = 360 / angleDelta
export const detectSpiralArms = (
  primes: number[],
  stepsPerRotation: number,
  numPredictions: number
): SpiralArm[] => {
  if (primes.length < 3) return [];

  // Global anchored curve; each arm layers its own shrunken offset on top
  const base = makePredictor(primes);

  const armBuckets: Map<number, ArmPoint[]> = new Map();
  primes.forEach((prime, index) => {
    const armIndex = index % stepsPerRotation;
    if (!armBuckets.has(armIndex)) armBuckets.set(armIndex, []);
    armBuckets.get(armIndex)!.push({ prime, index });
  });

  const arms: SpiralArm[] = [];
  armBuckets.forEach((points, armIndex) => {
    if (points.length >= 2) {
      const predict = makeArmPredictor(base, points);
      arms.push({
        armIndex,
        points,
        predictions: predictArmExtension(points, stepsPerRotation, numPredictions, predict),
      });
    }
  });

  arms.sort((a, b) => a.armIndex - b.armIndex);
  return arms;
};

// Compare predicted prime values against the actual primes. The position is
// exact (fixed by index), so error is purely in the prime's value.
export const calculateAccuracy = (arms: SpiralArm[], extendedPrimes: number[]): PredictionAccuracy => {
  let totalPredictions = 0;
  let correctPredictions = 0;
  let totalErrorPct = 0;

  arms.forEach(arm => {
    arm.predictions.forEach(prediction => {
      if (prediction.index < extendedPrimes.length) {
        totalPredictions++;
        const actualPrime = extendedPrimes[prediction.index];
        const relErr = Math.abs(prediction.prime - actualPrime) / actualPrime;
        totalErrorPct += relErr * 100;
        // Correct = predicted the prime's value within 0.1% of the true value
        if (relErr < 0.001) correctPredictions++;
      }
    });
  });

  return {
    totalPredictions,
    correctPredictions,
    averageErrorPct: totalPredictions > 0 ? totalErrorPct / totalPredictions : 0,
    accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0,
  };
};
