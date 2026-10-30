# J90 v0.3.2 — Precision-aware fractal explorer

## Research question

At what zoom levels do adjacent Mandelbrot or Julia pixel coordinates collide in Float64 arithmetic, and how sensitive are finite escape classifications to small viewport shifts? This work tests numerical sampling; it does not test physical chaos, life or consciousness.

## Navigation and budgets

The browser exposes pointer-wheel zoom at the cursor, click-to-centre, drag-to-pan, a reset control, zoom buttons, and keyboard arrows/plus/minus/Home when focused. CSS pointer coordinates are mapped into the canvas pixel grid. Complex input components and all viewport corners are constrained to [-4,4].

The horizontal span must lie in [1e-15, 6], widths in [8,320], heights in [8,240]. The iteration budget starts at 64 and increases by 8 per zoom octave, capped at 192. Work is limited to 9 million pixel-iteration units per grid. Disallowed operations are rejected; the previously accepted viewport is preserved.

## Precision watchdog

The watchdog computes the actual horizontal and vertical Float64 coordinates of every adjacent pixel centre and counts equal neighbours. Any collision blocks rendering and further zoom. An estimated ratio of pixel pitch to local ULP provides a warning below 8; it is not an independently proven propagated error bound. A very small span can be valid near zero yet unrepresentable around a nonzero centre. No arbitrary-precision arithmetic is claimed.

## Sensitivity overlay

When enabled, a second grid is rendered with a deterministic 0.25-pixel horizontal viewport shift. Magenta indicates that a pixel changed between escaped and not-escaped-within-budget; amber indicates a change in the recorded iteration count without a classification change. This is a finite-resolution *numerical* comparison, not a proof of chaotic dynamics, a bifurcation, mathematical set membership or a physical instability.

## Python reference, evidence and hashes

The Node CLI uses fixed wide Mandelbrot and Julia regions and a zoomed Mandelbrot region, and compares each pixel's finite escape iteration against an independently implemented Python stdlib algorithm. A mismatch fails the CLI rather than being silently ignored.

Pixel hashes use an explicit unsigned 16-bit little-endian representation, avoiding platform-native typed-array byte ordering. The overall SHA-256 report uses the existing JavaScript canonical JSON encoder. These receipts document deterministic outputs in the tested runtimes, not authenticated source provenance.

## Commands

~~~sh
npm test
npm run zoom
~~~

GitHub Actions runs both the full Node/Python test suite and the zoom CLI before publishing the browser module on main. Pull requests run tests but never deploy. The v0.1 linear oscillator, checkpoint version 1, and Robert Dumont attribution remain unchanged.
