// Anchored inverse Riemann-R prime prediction.
//
// R(x) = li(x) − li(√x)/2 counts primes below x almost exactly (the √x term
// cancels li's systematic overshoot). Anchoring on the last known primes
// (δ = mean of R(p_i) − i) removes the remaining local offset, so predicting
// the j-th prime is just inverting R at j + δ. Empirically this sits on the
// theoretical noise floor (~√m·ln p for m indices of lookahead) — no cheap
// model can do meaningfully better.

const GAMMA = 0.5772156649015329;

// Logarithmic integral via its convergent series (valid for x > 1)
export const li = (x: number): number => {
  const lnx = Math.log(x);
  let sum = GAMMA + Math.log(Math.abs(lnx));
  let term = 1;
  for (let k = 1; k < 200; k++) {
    term *= lnx / k;
    const add = term / k;
    sum += add;
    if (Math.abs(add) < 1e-16 * Math.abs(sum)) break;
  }
  return sum;
};

export const riemannR = (x: number): number => li(x) - li(Math.sqrt(x)) / 2;

const riemannRDeriv = (x: number): number => {
  const lnx = Math.log(x);
  return 1 / lnx - 1 / (2 * Math.sqrt(x) * lnx);
};

// Cipolla's asymptotic for the n-th prime (1-based) — used as the Newton seed
const SMALL_PRIMES = [2, 3, 5, 7, 11];
export const nthPrimeEstimate = (n: number): number => {
  // n may be fractional (smooth-curve sampling) — snap the small-n lookup
  if (n <= 5) return SMALL_PRIMES[Math.min(4, Math.max(0, Math.round(n) - 1))];
  const ln = Math.log(n);
  const lln = Math.log(ln);
  return n * (ln + lln - 1 + (lln - 2) / ln);
};

// Hybrid layer: a spiral arm's own recent deviations from the global curve
// nudge its predictions. The offset is shrunk toward zero (m/(m+8)) so a
// noisy arm can never do worse than the global model by more than noise —
// but each arm's history genuinely shapes where its extension goes.
export const makeArmPredictor = (
  base: (j: number) => number,
  armPoints: { index: number; prime: number }[]
): ((j: number) => number) => {
  const m = Math.min(5, armPoints.length);
  if (m === 0) return base;
  let mean = 0;
  for (let k = armPoints.length - m; k < armPoints.length; k++) {
    const p = armPoints[k];
    mean += p.prime / base(p.index) - 1;
  }
  mean /= m;
  const offset = (m / (m + 8)) * mean;
  return (j: number) => base(j) * (1 + offset);
};

// Returns predict(j) ≈ value of the j-th prime (0-based j), anchored to the
// known primes. Valid for past indices too (smooth curve through the data),
// which the residual-sheet layout relies on.
export const makePredictor = (primes: number[]): ((j: number) => number) => {
  const n = primes.length;
  if (n === 0) return (j) => nthPrimeEstimate(j + 1);

  const count = Math.min(10, n);
  let delta = 0;
  for (let i = n - count; i < n; i++) {
    delta += riemannR(primes[i]) - i;
  }
  delta /= count;

  return (j: number): number => {
    const target = j + delta;
    let x = Math.max(nthPrimeEstimate(j + 1), 3);
    for (let it = 0; it < 5; it++) {
      x = Math.max(2.001, x - (riemannR(x) - target) / riemannRDeriv(x));
    }
    return x;
  };
};
