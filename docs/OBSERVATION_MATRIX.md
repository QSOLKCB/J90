# J90 v0.2.2 — Observation access, provenance and numerical boundaries

## Research question

What can a paused oscillator **actually observe** when different external observers possess different channels? And how far can numerical evidence be trusted near floating-point boundaries?

This work extends v0.2.0 and v0.2.1. It does not introduce any self-awareness, internal clocks, or a general theory of dimensional transposition.

## Access-control matrix

The seven fixed v0.2.0 null scenarios are each projected to five profiles:

| Profile | Clock interval | External state sensor | Interruption-event flag |
| --- | --- | --- | --- |
| oscillator | No | No | No |
| timekeeper | Yes | No | No |
| sensor-reader | No | Yes | No |
| event-reader | No | No | Yes |
| external-observer | Yes | Yes | Yes |

Each observation is an **injected synthetic fixture**, not data from a physical experiment. With no channels, the oscillator has no information to distinguish a gap. A clock can tell that time elapsed, but cannot on its own establish that the oscillator stopped. A state sensor can see a difference without identifying its cause. An event log can explicitly *assert* an interruption, but its contents might be wrong or forged. Full-turn phase aliasing demonstrates that an independent clock and an endpoint state can disagree on the apparent significance of a gap.

## Evidence log protocol

Exactly three records, one per channel, have canonical sequence indices, channel-specific schema, declared source identifier, prior digest and SHA-256 digest. The first digest is chained to a fixed zero genesis. The verifier rejects altered fields, reordered events, missing channels, unsupported sources and malformed numeric readings. It checks deterministic integrity; it cannot authenticate who generated the source data.

**Forgery counterexample:** A caller can edit a clock observation and generate a fully consistent *new* hash chain. This is intentionally demonstrated in tests. Never describe the event chain as a cryptographic signature or independently verified provenance.

The source labels (\`synthetic-clock-v1\`, \`synthetic-sensor-v1\`, \`synthetic-event-log-v1\`) are plain claimed identifiers. Role projections operate on caller-supplied already-in-memory events; they are not a sandbox or confidentiality boundary. Both report and source digests are generated using the existing Node.js canonical JSON and SHA-256 routines without changing checkpoint version 1.

## Numerical stress

The fixed IEEE-754 grid includes:
- Initial states: unit amplitude; 1e-150 component scale; the smallest positive subnormal (\`Number.MIN_VALUE\`).
- Angular frequencies: 0, 1e-12, 1e-6, π/2, 2π, 1e6.
- Damping: 0, 1e-12, 0.05, 1, 710.
- Gap durations: 0, 1e-9, 0.125, 1, 10.
- Fixed before and after intervals: 0.125 and 0.25.

This yields **3 × 6 × 5 × 5 = 450** scalar-oracle comparisons, using v0.2.0's independent analytical distance formula. Reports include ordinary-tolerance agreement, exact-zero-tolerance agreement, measured residuals, and situations where \`exp(-γ gap)\` underflows to zero.

A zero-tolerance disagreement alone is not a bug or new physics: transcendental functions and floating-point operation order are not universally bitwise reproducible. Likewise a zero observed distance at subnormal scale may be numerical erasure, not physical identity.

## Additional cross-runtime cases

Six new Node.js ↔ Python stdlib cases are exercised by \`tests/edge-parity.test.mjs\`: tiny angle, subnormal initial state, exponent underflow, large phase, near-2π alias and tiny positive time increment. They add **30 checkpoint validations, 24 replay segments and 84 state comparisons** using declared 1e-9 absolute/relative tolerances. These are additional to (not a replacement for) the v0.2.1 corpus. This validates two implementations in the configured CI environment, **not** all platforms or language runtimes.

## Reproduction

~~~sh
npm test
npm run evidence
npm run evidence -- --full
npm run evidence -- --atol 0 --rtol 0  # intentionally stringent; may report FAIL
npm run parity
~~~

The default CLI shows compact group counts and SHA-256 report identifiers; \`--full\` includes every synthetic source event and numerical case. Non-finite/negative tolerances and invalid observation records fail closed. The existing GitHub Pages workflow tests this command before deployment but keeps the public browser app unchanged.

## Interpretation limit

Results support reproducible *information-access distinctions* and numerical robustness tests within defined models. They do **not** prove life, sleep, cognition, consciousness, authentic physical event provenance, or Robert Dumont's broader dimensional-transposition conjecture. The project's conceptual attribution remains intact.
