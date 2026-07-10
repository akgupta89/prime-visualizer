import { makeArmPredictor, makePredictor, nthPrimeEstimate } from './prediction';

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
  extensionPath: ArmPoint[]; // dense fractional-index samples along the precessing arm
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
// Arms exist at EVERY angle, one family per (semi)convergent denominator of
// Δ/360, and the family the EYE picks out is scale-dependent: the parastichy
// problem from phyllotaxis (Vogel/Ridley — why a sunflower shows 21/34/55
// spirals as it grows). The dominant family minimizes the spacing between
// CONSECUTIVE points on the same arm, measured where most points live. Picking
// the most exact family instead (the old behavior) yields the straightest but
// stubbiest arms — a starburst of 4-point rays at Δ=35° where the eye plainly
// sees 10 sweeping spirals.
//
// Integer math on the entered angle (at most 3 decimals) keeps drift exact.
const ANGLE_SCALE = 1000;
const FULL_TURN = 360 * ANGLE_SCALE;

// Fewer points than this and an arm doesn't read as one
const MIN_POINTS_PER_ARM = 5;

// Beyond this per-step precession the eye no longer chains points into an arm.
// Never changes a winner (validated) — it keeps the alternates list honest.
const MAX_DRIFT_DEG = 60;

// Where along the sequence the score is evaluated (outer-biased: the eye reads
// structure at the rim). The one perceptual knob — 0.5 and 0.8 both mis-pick
// (validated against browser observations at 35°, 37.2°, 110°, φ).
const REP_FRAC = 0.6;

export interface ArmStructure {
  period: number; // N — indices N apart share an arm
  driftDeg: number; // signed precession per step; 0 means an exact ray
}

export interface ArmCandidate extends ArmStructure {
  pointsPerArm: number;
  score: number; // within-arm neighbor spacing at the representative radius
}

// Denominators of ALL semiconvergents of n/d (every best one-sided rational
// approximation): during the CF recurrence with partial quotient a, emit
// q = j·qₖ₋₁ + qₖ₋₂ for j = 1..a.
const semiconvergentDenominators = (n: number, d: number): number[] => {
  const denominators: number[] = [];
  let qPrev2 = 1;
  let qPrev1 = 0;
  let num = n;
  let den = d;
  while (den !== 0) {
    const a = Math.floor(num / den);
    [num, den] = [den, num - a * den];
    for (let j = 1; j <= a; j++) {
      denominators.push(j * qPrev1 + qPrev2);
    }
    const qk = a * qPrev1 + qPrev2;
    qPrev2 = qPrev1;
    qPrev1 = qk;
  }
  return [...new Set(denominators)];
};

// Signed drift of a period-N arm, in degrees, within (−180, 180]
const driftDegrees = (period: number, n: number): number => {
  let r = (period * n) % FULL_TURN;
  if (r > FULL_TURN / 2) r -= FULL_TURN;
  return r / ANGLE_SCALE;
};

// All arm families this many primes can show, best (parastichy-dominant) first.
// Score = distance between consecutive points on one arm at the representative
// radius: radial step 0.01·q·ln(p) + tangential step r·|drift|.
export const armCandidates = (angleDelta: number, primeCount: number): ArmCandidate[] => {
  const n = Math.round(angleDelta * ANGLE_SCALE);
  if (n <= 0 || primeCount < MIN_POINTS_PER_ARM) return [];

  const maxPeriod = Math.floor(primeCount / MIN_POINTS_PER_ARM);
  const pRep = nthPrimeEstimate(Math.max(6, Math.floor(REP_FRAC * primeCount)));
  const rRep = 0.01 * pRep;
  const meanGap = Math.log(pRep);

  const toCandidate = (q: number): ArmCandidate => {
    const driftDeg = driftDegrees(q, n);
    const radial = 0.01 * q * meanGap;
    const tangential = rRep * Math.abs((driftDeg * Math.PI) / 180);
    return {
      period: q,
      driftDeg,
      pointsPerArm: Math.ceil(primeCount / q),
      score: Math.hypot(radial, tangential),
    };
  };

  const all = semiconvergentDenominators(n, FULL_TURN)
    .filter(q => q >= 1 && q <= maxPeriod)
    .map(toCandidate);

  const capped = all.filter(c => Math.abs(c.driftDeg) <= MAX_DRIFT_DEG);
  // The cap only empties the list at tiny prime counts — show something anyway
  const pool = capped.length > 0 ? capped : all;

  return pool.sort((a, b) => a.score - b.score);
};

// The family the eye picks out — the parastichy-dominant candidate
export const armStructure = (angleDelta: number, primeCount: number): ArmStructure | null =>
  armCandidates(angleDelta, primeCount)[0] ?? null;

// Maps a (index, prime) pair to scene coordinates for the active layout.
// Index may be fractional (used to sample smooth curves between points).
//
// Writes Cartesian xyz into `out` — every layout converts polar (r, θ) to
// Cartesian on the way out, so (r, θ) is only ever a local intermediate and is
// never stored. Nothing reads a position back as an angle; picking recovers the
// prime by buffer index. Ulam is the exception that skips polar entirely.
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
// Also returns a dense fractional-index path along the same precessing arm so
// the extension renders as a smooth spiral, not a chord through sparse points.
const predictArmExtension = (
  points: ArmPoint[],
  stepsPerRotation: number,
  numPredictions: number,
  predict: (j: number) => number,
  driftDeg: number
): { predictions: ArmPoint[]; extensionPath: ArmPoint[] } => {
  if (points.length < 2) return { predictions: [], extensionPath: [] };

  const lastPoint = points[points.length - 1];
  const predictions: ArmPoint[] = [];
  for (let step = 1; step <= numPredictions; step++) {
    const index = lastPoint.index + step * stepsPerRotation;
    predictions.push({ index, prime: Math.round(predict(index)) });
  }

  // Adaptive sampling: an exact ray (drift 0) is a straight line — 1 sample per
  // step; a fast-precessing arm needs more to draw the curve smoothly
  const substeps = Math.min(8, Math.max(1, Math.ceil(Math.abs(driftDeg) / 2)));
  const extensionPath: ArmPoint[] = [];
  const totalSamples = numPredictions * substeps;
  for (let s = 1; s <= totalSamples; s++) {
    const index = lastPoint.index + (s / substeps) * stepsPerRotation;
    extensionPath.push({ index, prime: predict(index) });
  }

  return { predictions, extensionPath };
};

// Detect spiral arms using RESIDUE CLASS grouping: arms are formed by primes
// at indices k, k+N, k+2N, ... where N is the parastichy-dominant period
export const detectSpiralArms = (
  primes: number[],
  stepsPerRotation: number,
  numPredictions: number,
  driftDeg: number
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
      const { predictions, extensionPath } = predictArmExtension(
        points,
        stepsPerRotation,
        numPredictions,
        predict,
        driftDeg
      );
      arms.push({ armIndex, points, predictions, extensionPath });
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
