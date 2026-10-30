# J90 v0.3.0 — Mandelbrot, Julia, and the 90° rotation counterexample

## Model distinction

A 90° linear rotation on a complex state is multiplication by i:

`J(z) = iz`, so `J²(z)=-z`, `J⁴(z)=z`, and `|J(z)|=|z|`.

The standard quadratic complex map is `f_c(z)=z²+c`. Its derivative is `f'_c(z)=2z`, and its real Jacobian determinant is `4|z|²`. It is neither globally isometric nor identical to multiplication by i. At z=0, c=0, the map sends zero to zero while linear J rotates any nonzero input without changing its norm. At z≈1 a perturbation in the real direction is approximately doubled; near z=0 it contracts. These falsify a universal equivalence or universal distance-conservation conjecture for the quadratic map.

For **Mandelbrot**, set z₀=0 and vary parameter c across the plane. For **Julia**, fix c and vary z₀. This is a material difference, not merely a different palette or viewing angle.

## Escape algorithm and evidence limits

The escape condition uses the conservative radius `max(2, |c|+1)`, evaluated after each update, or at step zero for an already-outside Julia starting point. The count records how many quadratic iterations occurred before detection. Radius 2 is sufficient for standard low-magnitude parameters; for larger |c| the stricter adaptive radius prevents incorrectly classifying transient excursions as proven divergence. The computed escape criterion is sufficient for divergence in this quadratic family, but finite-budget non-escape never proves membership.

If no escape occurs before the configured limit, the classification is **not-escaped-within-budget**, *not* inside the set. Grids use a dedicated 65535 sentinel for this classification; escapes at exactly the final allowed iteration retain their iteration count and are displayed as escaped. Numerical underflow, long transients, phase aliasing, and small-scale precision are limitations of finite float64 computation.

Allowed inputs are finite with components in [-4,4]; max iterations 1..512; viewport dimensions at most 320×240; span 0..6 (exclusive at zero). Grid order is row-major, pixel centers sampled at half-pixel offsets, with the imaginary coordinate increasing upward. No random sampling or network requests.

## Reproducibility

```sh
npm test
npm run nonlinear
```

The CLI reports six fixed orbit probes, two deterministic 96×64 grids (Mandelbrot and a Julia set), counts of escaped and unescaped-within-budget pixels, SHA-256 of each grid buffer, and an overall canonical JSON report receipt. Browser implementation imports the same pure core; the separate webpage portrait is not a cryptographic receipt.

## Falsification controls

- `J(1+i)=-1+i`; `f_0(1+i)=2i`. Unequal.
- A quarter-turn retains the distance between nearby states; a quadratic map at z=1 with real perturbation ε=0.01 changes separation by factor 2.01; at z=0 the factor is 0.01.
- Mandelbrot c=0 and c=-1 have non-escaped orbits over the tested budget; c=2 escapes after two updates using the strict >2 comparison.
- Julia c=0, z₀=1 remains at 1; starting z₀=2 escapes after one update.
- A fixed Julia c=-0.8+0.156i can produce a different landscape from the Mandelbrot parameter plane, but visual resemblance is **not** evidence of structural equivalence.

## Attribution and claims discipline

Robert Dumont (@Voltardark) inspired the question about an orthogonal counterpart and a Mandelbrot connection; this is independent QSOL-IMC analysis of **standard** mathematical dynamical systems. We have not validated the full dimensional-transposition manuscript or attributed any implementation authorship to Robert. Mathematical model differences cannot establish or refute biological life, subjective experience, cognition or a physical universal law.
