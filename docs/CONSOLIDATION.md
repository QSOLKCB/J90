# J90 v0.3.3 — Nonlinear evidence consolidation

## Research question

How do finite quadratic escape observations change when the iteration budget increases, when the sampled viewport zooms, and when an independent Python implementation repeats the same calculation? This is a numerical **reproducibility and convergence audit**, not evidence of physical chaos, life or consciousness.

## Fixed corpus and invariant

The corpus has two independent model families (Mandelbrot: variable parameter c with z0=0; Julia: fixed c with variable initial z0), three zoom spans [2, 1, 0.5], and iteration budgets [48, 96, 160], each on a 33×25 pixel grid. That is **18 grids and 14,850 pixel comparisons** against a separate Python standard-library implementation. The model definitions, bailout radius, Float64 coordinate limits and "not escaped within budget" sentinel are inherited from v0.3.0–v0.3.2. Every accepted grid is subject to the precision watchdog.

Within one model, centre and scale, higher iteration caps must preserve previously observed escape times **exactly**. A pixel that did not escape at cap 48 may newly escape at 96 or 160, but never the reverse. Any earlier escape-time change is a hard failure. Non-escape at the largest cap still **does not prove set membership**. A decreasing unresolved count is an expected property of an increased finite horizon, **not** proof of global convergence.

## Across zoom scales

Zooming samples a different collection of coordinates. It is invalid to compare corresponding pixel *indices* across views as though they were the same point. We use odd width/height so the centre pixel aligns, and take 25 explicitly matched nearby pixel offsets for each consecutive 2× scale. The report includes the count of exactly identical Float64 complex coordinates, coordinate drifts where nominally aligned points differ in rounding, and any escape-time disagreements **only at exactly identical** points. Near-but-unequal coordinates are not silently assumed equivalent.

The Python grid oracle uses its own quadratic recurrence and input validation, while following the specified pixel-centre arithmetic order; there is no reuse of Node iteration code. Each output case is validated for identity, dimensions and integer iteration-count range. Exact mismatches are retained as evidence and cause an overall FAIL; the test does not silently widen tolerances or discard difficult points.

## Evidence format and reproducibility

`npm run consolidate` prints a deterministic JSON report. `npm run consolidate -- --out evidence-v0.3.3` creates a **new** directory (never overwrites one) with:

- `manifest.json`: versioned study inputs, model/scale/budget summaries, exact comparison counts, mismatches, pixel SHA-256, and SHA-256 for source files including the Python reference.
- `REPRODUCE.txt`: standalone reproduction notes.
- `SHA256SUMS.txt`: hashes for both outputs, independently checkable using `sha256sum -c SHA256SUMS.txt`.

Every uint16 escape-time pixel buffer is encoded **little-endian** before hashing. The manifest includes a SHA-256 over its canonical *pre-hash* report, according to JavaScript v1 canonical rules. The manifest contains its digest but cannot self-hash without recursion; `SHA256SUMS.txt` covers the final file. No timestamp or unseeded randomness contaminates the report.

CI appends `environment.txt` containing Node version, Python version, OS and architecture and adds its checksum. The existing Pages workflow runs these checks on PRs and main, and uploads an Actions artifact with a **30-day retention**. This is **not** a durable Zenodo/OSF publication; any permanent publication remains a separate, explicitly approved action. CI may run the same source on another system with slightly different low-level numerical results—record differences, do not falsely claim bitwise portability.

## Fail-closed conditions

Invalid inputs, inconsistent oracle shape or ordering, noninteger pixel counts, a changed prior escape iteration, illegal output directory names, and overwriting an existing evidence directory all fail. The final report result is FAIL if either cross-runtime grid counts or exactly aligned spatial samples disagree. Errors are never interpreted as "emergence."

## Commands

~~~sh
npm test
npm run consolidate
npm run consolidate -- --out evidence-v0.3.3
cd evidence-v0.3.3 && sha256sum -c SHA256SUMS.txt
~~~

No modifications to the core linear oscillator, checkpoint format, attribution, or public browser mathematics. Conceptual inspiration remains credited to Robert Dumont (@Voltardark); J90 does not validate an unverified dimensional-transposition manuscript or infer consciousness from complex arithmetic.
