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

The classic view draws each prime as a **vector**. The prime is the magnitude; the angle delta sets the direction. Prime 2 points along 0·Δ, prime 3 along 1·Δ, prime 5 along 2·Δ, and so on. Lay the arrows head to tail and follow where the walk lands.

<img src="docs/example.svg" alt="Left: primes 2, 3, 5, 7, 11 drawn as arrows laid head to tail, each turned 36 degrees from the last. Right: after sixty primes the same walk has traced a spiral, with a red dot marking where each prime lands.">

Sixty primes in, the walk has traced a spiral — and it is the *same* spiral the app renders. That is not obvious, because the renderer never accumulates anything.

### Why the closed form is the walk

The renderer places the n-th prime directly at radius `0.01·p` and angle `n·Δ`. No prefix pass, no running total, O(1) per point, and it accepts fractional indices — which the arm-extension curves in `src/lib/arms.ts` depend on. The walk, by contrast, is a running sum of every prime before it.

They agree because of **Abel summation**. For a partial sum `Sₙ = Σₖ aₖ·zᵏ` with `|z| = 1` and `aₖ` slowly varying, the sum is dominated by its final term:

```
Sₙ  ≈  aₙ·zⁿ · k        where  k = 1 / (1 − z⁻¹)
```

Primes grow smoothly (`pₙ ~ n·ln n`), so they qualify. The walk's entire accumulated history collapses into that single constant complex `k`, and `aₙ·zⁿ` is precisely the point the renderer draws. Dividing the walk's position by the rendered position converges to `k` and nothing else.

Since `|k| = 1 / (2·sin(Δ/2))` and `arg k = −(90° − Δ/2)`, the constant depends only on Δ:

| Δ | scale `|k|` | rotation `arg k` |
|---|---|---|
| 36° *(the default)* | **1.6180** — exactly φ, since `2·sin 18° = 1/φ` | −72° |
| 57.30° *(1 radian)* | 1.0429 | −61.35° |

**The walk is the rendered spiral under a similarity transform** — one uniform scale, one rotation. Through a camera you can orbit, that is no difference at all.

So the arms are not an artifact of drawing order. They survive because the walk and the closed form are the same picture, and the closed form is simply the cheaper way to draw it.

### Where it stops working

This does not carry over to the value-mapped layouts. **π spiral** sets θ = p, so consecutive angles lurch forward by the prime gap — 2, 4, 6 radians — instead of stepping by a fixed Δ. The phase is not slowly varying, Abel summation does not apply, and no walk interpretation exists. That is why π spiral renders nothing like the classic view despite using the same radius.

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
