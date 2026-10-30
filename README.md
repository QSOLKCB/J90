# J90 — Orthogonal Oscillator Research Laboratory

A small, deterministic research laboratory for 90° rotations, quadrature oscillators, state persistence, and interruption/recovery experiments. Inspired by a public question from Robert Dumont (@Voltardark), J90 tests *operational, mathematical* claims without presupposing life, agency, or consciousness.

**Status:** v0.1.0 foundation / exploratory research. **License:** Apache-2.0.

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

Requires Node.js 20+ only. No installation, dependency downloads, network, CI, or hidden randomness.

~~~sh
npm test
npm run experiment
npm run experiment -- --omega 1.57 --damping 0.1 --before 1 --gap 2 --after 1
~~~

Output is machine-readable JSON including experiment inputs, results, a canonical SHA-256 checkpoint, and interpretation limits. All times are abstract nonnegative time units; omega is radians per unit time.

## Browser demonstration

Serve the repository root over HTTP (for ES modules):

~~~sh
python3 -m http.server 8000
~~~

Then visit http://localhost:8000/. The static interactive lab needs no backend and can also be published through GitHub Pages using **Deploy from a branch / main / (root)** after merging. This browser demonstration uses the same pure oscillator kernel as the Node experiment; checkpoint hashing and structured results remain in the Node CLI.

## Reproducibility and scientific scope

- Deterministic closed-form linear evolution, finite-number validation, pure functions.
- Tests for quarter-turn algebra, energy, damping, checkpoint reproducibility, tampering, interruption, and negative cases.
- No reliance on presumed "emergence"; no claim that a geometrical rotation proves consciousness, new physics, or equivalence of unrelated mathematical transforms.
- Checkpoints are integrity receipts, not cryptographic proof of physical truth.
- See [experiment protocol](docs/EXPERIMENTS.md), [attribution](docs/ATTRIBUTION.md), [invariants](docs/INVARIANTS.md), and [roadmap](docs/ROADMAP.md).

## Credit and provenance

**Project and independent implementation:** QSOL-IMC (Trent Slade).

**Conceptual prompt and research inspiration:** Robert Dumont ([@Voltardark](https://x.com/Voltardark)), particularly his public comment about a 90° geometrically inverse counterpart, maintained oscillation, and a system's inability to observe an interruption without an external signal, alongside his advertised *The Law of Dimensional Transposition — The 90° Joints as a Universal Operator J(θ), Version 4.0* (October 2026; described as AMENRA S-DMT / USM Collective work).

This is an **independent exploration**, not a reproduction, endorsement, validation, or collaboration claimed on Robert's behalf. See [ATTRIBUTION.md](docs/ATTRIBUTION.md) for source/verification limitations.

> **Correctness outranks a compelling story.** If an experiment returns an ordinary trigonometric result, we report an ordinary trigonometric result.
