# Prime Visualizer

An interactive laboratory for prime number patterns. Primes are rendered as a GPU point cloud (smooth at 100,000 primes) that can be re-mapped through seven layouts, colored through three scientific encodings, filtered through number-theoretic lenses, and extrapolated by a prediction model that sits at the theoretical accuracy floor.

**Live demo:** [https://akgupta89.github.io/prime-visualizer](https://akgupta89.github.io/prime-visualizer)

## Quick start

```sh
npm install
npm run dev
```

Open the URL printed in your terminal.

## The vector walk

The classic view draws each prime as a **vector**: the prime is the magnitude, and the angle delta gives the direction. Lay the arrows head to tail — prime 2 pointing along 0·Δ, prime 3 along 1·Δ, prime 5 along 2·Δ — and the patterns emerge from where the walk lands.

<img src="docs/example.svg" alt="Primes drawn as vectors laid head to tail">

The renderer never accumulates anything. It places the n-th prime directly at radius `0.01·p` and angle `n·Δ`, an O(1) closed form with no prefix pass, no state, and support for fractional indices (which the arm-extension curves rely on). The two agree because of **Abel summation**: for a sum `Σ aₖ·zₖ` with `|z| = 1` and `aₖ` slowly varying, the partial sum is dominated by its final term,

```
Sₙ  ≈  aₙ·zⁿ · 1/(1 − z⁻¹)
```

Primes grow smoothly enough (`pₙ ~ n·ln n`) to qualify, so the entire accumulated history of the walk collapses into a single constant complex factor. Dividing the walk's position by the rendered position converges to exactly that constant — at Δ ≈ 1 rad, a magnitude of 1.0429 and a phase of −61.35°. **The walk is the rendered spiral, scaled 4% and rotated 61°** — a similarity transform, and therefore invisible through a camera you can orbit.

This is what makes the arms real rather than an artifact of drawing order. They survive because the walk and the closed form are the same picture.

It does not carry over to the value-mapped layouts. **π spiral** sets θ = p, so consecutive angles lurch by the prime gap (2, 4, 6 radians) instead of stepping by a fixed Δ. The phase is not slowly varying, Abel summation does not apply, and there is no walk interpretation — which is why it renders nothing like the classic view despite sharing the same radius.

## Layouts

**Index-mapped** — the n-th prime is placed by its position in the sequence:

- **Classic** — the vector walk (see below): angle = index · Δ, radius ∝ prime. With N = 360/Δ an integer, every N-th prime shares a ray, forming the "spiral arms" (residue classes of the index). For non-divisor angles the arms the eye picks out correspond to continued-fraction convergents of Δ/360 — at the golden angle those are Fibonacci numbers, which is why a sunflower shows 34/55/89 spirals.
- **Residual 3D** — radius follows the *smooth* inverse Riemann-R curve (a pure function of index), so predicted positions are exact by construction; each prime's deviation from the curve becomes the z-axis. The irreducible "noise" of the primes reads as a rippled sheet.
- **Helix 3D** — index as height, log radius: arms become helical strands.

**Value-mapped** — the prime's own value sets the position:

- **π spiral** — polar (r, θ) = (p, p radians). Rational approximations of 2π (44/7, 710/113) create emergent structure: ~6 Archimedean spirals up close, 44 spirals zoomed out, 710 rays beyond.
- **Vogel / phyllotaxis** — θ = p · 137.5078° (the golden angle), r ∝ √p: each prime as sunflower seed #p. Integers would tile the disc uniformly; the primes' clusters and voids are the signal.
- **Ulam** — the classic square integer spiral with primes lit; quadratic-polynomial diagonals emerge.
- **ƒ(p, i) custom** — type your own formulas for r, θ (radians), and z using `p` (prime), `i` (index), `n` (count), all of `Math`, and the constants `PI`, `TAU`, `PHI`, `GOLDEN` (golden angle in radians), plus `fib(k)`. Starter presets included.

## Color modes, lenses & connectors

- **Color by**: spiral **arm** (hue per residue class, re-hues live with Δ), **gap** to the next prime (log scale, twin primes gold), or **sequence** position. A legend bound to the active mode explains the mapping.
- **Lenses** (mutually exclusive, GPU-dimmed): **twin primes**, **residue classes** p ≡ a (mod 4/6/12), and **Fibonacci primes** (only nine exist below 1.3M: 2, 3, 5, 13, 89, 233, 1597, 28657, 514229).
- **Connectors**: link consecutive primes, or draw **Fibonacci chords** p(i) → p(i+F) for F ∈ {5, 8, 13, 21} — lag chords weave rose/moiré patterns because consecutive Fibonacci ratios approximate φ.
- **Model curve** — overlay the smooth R⁻¹ growth curve the predictions ride on.

## Prediction model

Spiral-arm predictions extrapolate each arm's future primes using an **anchored inverse Riemann-R model**: R(x) = li(x) − li(√x)/2 is inverted by Newton's method, anchored to the last known primes (δ = mean of R(pᵢ) − i), plus a small shrinkage-weighted per-arm offset. Measured accuracy: **~0.3% average error 100 steps ahead** from 300 known primes — essentially the theoretical noise floor (√m · ln p, the random walk of gap deviations), so no cheap model can do meaningfully better. Red = predicted, green = actual, yellow = error; the analysis dock reports accuracy, the gap distribution, and the π(x) − R(x) deviation.

## Scientific tools

- **Stats strip** — π(x), largest prime, max gap, twin count, mean gap vs ln p, live.
- **Analysis dock** — prediction accuracy, gap-distribution histogram, π(x) − R(x) deviation sparkline.
- **Click-to-pin inspector** — click any prime for index, neighbor gaps, arm, and deviation from the R-curve; its whole arm stays highlighted (Esc releases).
- **Hover tooltip**, **2D/3D camera**, **light/dark themes**, **PNG export** at 2× resolution.

## Performance

One `THREE.Points` draw call with a custom glow shader; colors, highlights, and connectors update GPU buffers in place (no geometry rebuilds); demand rendering (zero draws when idle); shared incremental prime sieve. 100k primes load in ~1.5 s and orbit at 60 fps.

## Deployment

```sh
npm run deploy
```

Deploys the static export to GitHub Pages (served from `/prime-visualizer`).

## License

MIT — see the LICENSE file.

## Acknowledgments

- Stanisław Ulam for the square spiral (1963)
- Bernhard Riemann for R(x)
- Helmut Vogel for the phyllotaxis model

---

Rebuilt by [Claude](https://claude.com/claude-code)
