# Cross-runtime checkpoint replay — J90 v0.2.1

## Question

Can a Node.js JavaScript implementation and an independently coded Python implementation resume identical oscillator checkpoint states through repeated interruptions and obtain numerically consistent trajectories?

This is a **numerical reproducibility test**, not proof of physical persistence, consciousness or a universal operator.

## Implementations

- **Node.js 20+ emitter and comparator:** the original \`evolve\`, canonical checkpoint v1, \`loadCheckpoint\`, and numeric comparison code in \`src/cross-runtime.mjs\`.
- **Python 3.11+ independent consumer:** stdlib \`math\`, \`hashlib\`, \`json\` and \`re\` only, \`scripts/python_replay.py\`. It implements the differential-equation solution on its own, checks every incoming Node-issued checkpoint against SHA-256 of the **exact source payload bytes**, and validates the v1 fields/order.
- **Single fixed subprocess:** \`python3 scripts/python_replay.py\` is invoked using \`spawnSync\` with \`shell: false\`, a timeout and bounded output. No caller-provided paths/executables, network, user data or physical clock.

**Caveat:** Python's default JSON number formatting is not guaranteed to reproduce JavaScript's \`JSON.stringify\` canonical representation (e.g. integral floats, exponents and negative zero). The v1 format is issued by Node; Python acts as a *consumer* checking a constrained envelope, field order and checksum of raw payload, not an independent cross-language canonical JSON serializer. The Node \`loadCheckpoint\` verifies full JS canonicality before invoking Python. General bidirectional canonical checkpoint emission is future work.

## Fixed corpus

Eight deterministic cases: zero gap, zero vector, full-turn aliasing, quarter-turn, damped rotation, tiny steps, static state, and pure amplitude decay. Each case has **four durations** and **five checkpoints** (including the initial state). Total: **32 replay segments, 40 independent integrity validations, 112 numeric state comparisons**.

For each step Python (1) restores the Node-issued checkpoint, (2) calculates the next state using its own \`math.sin\`, \`math.cos\`, \`math.exp\`, and (3) also advances an independent Python-only trajectory. Node compares: restored state, independent trajectory, and resumed next state to its original snapshots. The computed norm of each state difference is checked against:

\[
\mathrm{error} \leq \mathrm{atol} + \mathrm{rtol}\max(\lVert s_{Node}\rVert,\lVert s_{Python}\rVert).
\]

Default \`atol = 10^{-12}\`, \`rtol = 10^{-12}\`; negative, infinite or overflowing tolerances fail closed. The comparisons are deterministic, not probabilistic. Strictly zero thresholds can show floating-point library differences and do not necessarily signify a mathematical error.

## Receipts and failure cases

The command outputs a JSON manifest with all cases, per-step comparisons, maximum absolute error, the requested tolerance, a SHA-256 hash of the canonical Node request, and a SHA-256 hash of the canonical Node report. The hashes are reproducibility/integrity receipts, **not** evidence of physical validity or signatures of trusted origin.

The test suite sends deliberately altered checkpoint data, duplicate JSON keys, nonfinite 1e999, mismatched replay schedules, and simulated numerical disagreements. Each must fail. Python rejects malformed or oversized requests, unknown fields, repeated identifiers and invalid parameter ranges. No secrets or third-party dependencies are required.

## Commands

~~~sh
npm test
npm run parity
npm run parity -- --atol 1e-12 --rtol 1e-12
python3 scripts/python_replay.py < fixtures.json  # fixtures must be a Node-issued protocol envelope
~~~

CI configures Python 3.12 and Node.js 22, runs the full suite on PRs, then runs the parity CLI as a smoke test. Only a successfully tested \`main\` build may deploy the unchanged J90 public browser laboratory.

## Boundaries of the claim

Passing parity on these two runtimes and scenarios does not guarantee bitwise identity across every JavaScript engine, Python version, platform, architecture or libm. The oscillator is intentionally linear, contains no wall-clock observations, and makes no claim about biological sleep, life, identity or awareness. Maintain attribution to Robert Dumont for motivating the experiment; any theoretical generalization requires independently falsifiable equations and evidence.
