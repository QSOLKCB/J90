# J90 adversarial control protocol v0.2.0

**Purpose.** Attempt to falsify over-general interpretations of the J90 pause/resume experiment before introducing more complicated dynamics. All results concern a deterministic linear oscillator, not life, awareness or consciousness.

## Quantitative prediction

For initial amplitude A₀ = √(x₀²+y₀²), angular frequency ω, damping γ ≥ 0, and time spans b = before, g = gap, a = after, the analytic prediction for the Euclidean distance between a paused/resumed trajectory and one that evolved through the gap is

\[
D = A_0 e^{-\gamma(b+a)}
    \left| e^{(-\gamma+i\omega)g} - 1 \right|.
\]

The analytical implementation uses a trigonometric scalar formula with \`Math.expm1\` and \`sin(φ/2)\` to reduce cancellation near zero. The *measured* distance uses two independent \`evolve\` trajectories from \`core.mjs\`. They must match within \`atol + rtol × max(D, observed)\`, where both error thresholds default to \`1e-12\`. This finite-precision check **is not** a statistical significance test.

The baseline is mathematical. A close match validates implementation consistency, **not** Robert Dumont's broader dimensional-transposition hypothesis. Rotation is not independent empirical evidence of emergence.

## Adversarial registry (7 fixed examples)

| ID | Model | Falsification purpose |
| --- | --- | --- |
| zero-gap | g = 0 | No interruption exists |
| zero-state | s = (0,0) | An absorbing origin can mask dynamics |
| static | ω = γ = 0 | A system can remain unchanged without a phase history |
| phase-alias | ωg = 2π, γ = 0 | Completed turns are observationally indistinguishable at endpoints |
| quarter-turn | ωg = π/2, γ = 0 | Familiar geometry changes the observed state without consciousness |
| pure-decay | ω = 0, γ = 0.4 | Damping changes amplitude without rotation |
| generic | ω = 1, γ = 0.05 | Both phase and amplitude can change |

The fixed boundary sweep additionally runs 4 angular frequencies × 2 damping values × 3 gap durations = 24 comparisons. It uses no random data, network or wall-clock readings.

## Observation access is explicit

\`observeExternal\` accepts only caller-supplied channels:

- \`clock: {atPause, atResume}\` — finite, monotone numeric readings. A positive elapsed duration is evidence that time elapsed for an observer possessing this clock; it does not establish why a system was interrupted.
- \`sensor: {before: {x,y}, after: {x,y}}\` — two finite external state measurements. Their distance can demonstrate a state difference at the specified error budget, **not** its cause.
- \`memory: {interruptionRecorded: boolean}\` — an explicitly supplied event report, which can report an interruption. This does not emerge from the oscillator state.

No channel is inferred or injected. No internal clock or unreported sensor exists. A pause may be observationally identical at the oscillator state even though an outside observer has different information. This is an *access-to-evidence* result, not evidence of sleeping or awareness.

## Reproduce

~~~sh
npm test
npm run controls
npm run controls -- --case phase-alias
npm run controls -- --case quarter-turn
~~~

The JSON report includes registry cases, the independent oracle, error budget, actual distance, agreement, and a canonical SHA-256 checkpoint from the prior v0.1 protocol. The \`--all\` run fails with a nonzero exit code if any analytical comparison or checkpoint replay fails. The GitHub Pages workflow runs that same command before deployment.

## Research controls and limitations

- Float64 arithmetic and elementary transcendental functions are not guaranteed bitwise identical across all compliant JavaScript engines. The tolerance is explicit; no cross-runtime bitwise guarantee is implied.
- Endpoint aliasing does not imply lack of energy exchange, biological function, or absence/presence of experience.
- False evidence (fabricated sensor readings or event reports) is beyond this mathematical model. Checkpoint SHA-256 tests integrity only.
- The actual \`runProtocol\` checkpoint is Node-only; browser visualizations never pretend to execute cryptographic receipts.
- This version does not implement Mandelbrot/Julia sets, cross-runtime differential replay, or Robert Dumont's entire conjectured operator family. Those remain future, separately assessed hypotheses.
