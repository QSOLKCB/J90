# J90 — Orthogonal Oscillator Research Laboratory

A small, deterministic research laboratory for 90° rotations, quadrature oscillators, state persistence, and interruption/recovery experiments. Inspired by a public question from Robert Dumont (@Voltardark), J90 tests *operational, mathematical* claims without presupposing life, agency, or consciousness.

**Status:** v0.3.1 real-axis stability and bifurcation candidates / exploratory research. **License:** Apache-2.0.

## What it actually demonstrates

For the counterclockwise quarter-turn operator

\[
J=\begin{bmatrix}0 & -1\\1 & 0\end{bmatrix},\qquad J^2=-I,\quad J^4=I
\]

the model is the familiar linear dynamical system

\[
\dot{s}=(\omega J-\gamma I)s,\qquad
s(t+\Delta t)=e^{-\gamma\Delta t}R(\omega\Delta t)s(t).
\]

The state is a two-component real vector. In the undamped case its squared norm is conserved up to floating-point rounding. With damping, squared norm decays exponentially.

The interruption experiment saves an exact model state, advances **no logical time** during a simulated gap, and restores it. The same-state/no-clock reference and resumed branches match exactly because they have the same inputs. An independently advancing clock or physical system can reveal a gap. **This is a test of information available to an observer, not a test of whether anything is alive.**

## Run the experiment

Requires Node.js 20+ and, for cross-runtime parity, Python 3.11+ (stdlib only). There are no runtime package dependencies, dependency downloads, or hidden randomness. Tests and experiments do not require network access; GitHub Actions runs the test suite before publishing the static site.

~~~sh
npm test
npm run experiment
npm run experiment -- --omega 1.57 --damping 0.1 --before 1 --gap 2 --after 1
npm run controls
npm run controls -- --case phase-alias
npm run parity
npm run parity -- --atol 1e-12 --rtol 1e-12
npm run evidence
npm run evidence -- --full
npm run nonlinear
npm run stability
~~~

The experiment, controls, parity and evidence commands produce machine-readable JSON with validated inputs and interpretation limits. The original experiment emits a canonical SHA-256 checkpoint; the adversarial controls command includes registry results, analytical comparisons, and replay receipts. All times are abstract nonnegative time units; omega is radians per unit time.

## Browser demonstration

Serve the repository root over HTTP (for ES modules):

~~~sh
python3 -m http.server 8000
~~~

Then visit http://localhost:8000/. The static interactive lab needs no backend. The browser includes a **seven-case adversarial challenge panel** and a **Mandelbrot/Julia interactive escape-time portrait** and a **real-axis stability plot** using the same browser-safe analytical oracle and oscillator kernel. Checkpoint hashing and structured experiment receipts remain in the Node CLI.

### GitHub Pages (GitHub Actions source)

The repository is configured for **Settings → Pages → Build and deployment → Source: GitHub Actions**. The [deployment workflow](.github/workflows/deploy-pages.yml) automatically runs on pushes to `main`, including merges, and also supports **Actions → Deploy J90 Laboratory → Run workflow** for manual publication.

The workflow uses Node.js 22 and Python 3.12 and runs `npm test`, the original experiment smoke test, the v0.2 controls report, and the cross-runtime parity command, and the evidence/stress command, the nonlinear comparison CLI, and the stability CLI. Pull requests run validation without publishing. Pushes to `main` and manual dispatches package a minimal `_site` containing the static browser files, shared adversarial oracle, nonlinear map and visualizer, and attribution page, then deploy **only after validation passes**. The deployment job alone receives Pages write / OIDC permissions. No npm dependencies or build tool are needed. The published address is [https://qsolkcb.github.io/J90/](https://qsolkcb.github.io/J90/).

After any merge to `main`, review **Actions → Deploy J90 Laboratory** for test and deployment results. PRs run validation but do not deploy. The v0.2.2 evidence tools remain CLI-only; the v0.3.0 nonlinear comparison runs separately from the v0.1 linear oscillator, in its own browser module.

## Reproducibility and scientific scope

- Deterministic closed-form linear evolution, finite-number validation, pure functions.
- Tests for quarter-turn algebra, energy, damping, checkpoint reproducibility, tampering, interruption, and negative cases.
- A seven-case falsification registry and 24-point deterministic boundary sweep; a separate scalar analytical oracle checks numerical agreement within a declared absolute/relative tolerance.
- Explicit optional observation channels (clock, sensor, recorded interruption) that never read a hidden wall clock or infer awareness from a signal.
- See [Adversarial Protocol v0.2](docs/ADVERSARIAL.md) for formulas, known confounders, and evidence limitations.
- **v0.2.1:** Node.js issues 40 checkpoint receipts across eight fixed scenarios; Python verifies SHA-256 over each raw payload and independently replays 32 segments. Comparison checks both resumed snapshots and Python-only trajectories against bounded numerical tolerances. See [cross-runtime protocol](docs/CROSS_RUNTIME.md).
- **v0.2.2:** explicit 35-cell synthetic observer-access matrix with source-labelled, SHA-256 hash-chained events; 450-case deterministic IEEE-754 boundary sweep; six additional Node/Python edge cases with 30 checkpoints and 84 comparisons. See [observation/provenance protocol](docs/OBSERVATION_MATRIX.md).
- **v0.3.0:** a separate deterministic complex quadratic map, Mandelbrot and Julia escape-time probes, a sensitivity counterexample against 90° rotation, fixed image-grid receipts, and an interactive browser portrait. See [nonlinear protocol](docs/NONLINEAR.md).
- **v0.3.1:** deterministic real-axis sweep, finite-window period candidates, tangent-vs-finite-difference comparisons, Python differential reference and versioned receipts. See [stability protocol](docs/STABILITY.md).
- No reliance on presumed "emergence"; no claim that a geometrical rotation proves consciousness, new physics, or equivalence of unrelated mathematical transforms.
- Checkpoints are integrity receipts, not cryptographic proof of physical truth.
- See [experiment protocol](docs/EXPERIMENTS.md), [attribution](docs/ATTRIBUTION.md), [invariants](docs/INVARIANTS.md), and [roadmap](docs/ROADMAP.md).

## Credit and provenance

**Project and independent implementation:** QSOL-IMC (Trent Slade).

**Conceptual prompt and research inspiration:** Robert Dumont ([@Voltardark](https://x.com/Voltardark)), particularly his public comment about a 90° geometrically inverse counterpart, maintained oscillation, and a system's inability to observe an interruption without an external signal, alongside his advertised *The Law of Dimensional Transposition — The 90° Joints as a Universal Operator J(θ), Version 4.0* (October 2026; described as AMENRA S-DMT / USM Collective work).

This is an **independent exploration**, not a reproduction, endorsement, validation, or collaboration claimed on Robert's behalf. See [ATTRIBUTION.md](docs/ATTRIBUTION.md) for source/verification limitations.

> **Correctness outranks a compelling story.** If an experiment returns an ordinary trigonometric result, we report an ordinary trigonometric result.
