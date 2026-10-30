# J90 — Orthogonal Oscillator Research Laboratory

A small, deterministic research laboratory for 90° rotations, quadrature oscillators, state persistence, and interruption/recovery experiments. Inspired by a public question from Robert Dumont (@Voltardark), J90 tests *operational, mathematical* claims without presupposing life, agency, or consciousness.

**Status:** v0.2.0 adversarial controls / exploratory research. **License:** Apache-2.0.

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

Requires Node.js 20+ only. No runtime dependencies, dependency downloads, or hidden randomness. Tests and experiments do not require network access; GitHub Actions runs the test suite before publishing the static site.

~~~sh
npm test
npm run experiment
npm run experiment -- --omega 1.57 --damping 0.1 --before 1 --gap 2 --after 1
npm run controls
npm run controls -- --case phase-alias
~~~

Both commands produce machine-readable JSON with validated inputs and interpretation limits. The original experiment emits a canonical SHA-256 checkpoint; the adversarial controls command includes registry results, analytical comparisons, and replay receipts. All times are abstract nonnegative time units; omega is radians per unit time.

## Browser demonstration

Serve the repository root over HTTP (for ES modules):

~~~sh
python3 -m http.server 8000
~~~

Then visit http://localhost:8000/. The static interactive lab needs no backend. The browser now also includes a **seven-case adversarial challenge panel** using the same browser-safe analytical oracle and oscillator kernel. Checkpoint hashing and structured experiment receipts remain in the Node CLI.

### GitHub Pages (GitHub Actions source)

The repository is configured for **Settings → Pages → Build and deployment → Source: GitHub Actions**. The [deployment workflow](.github/workflows/deploy-pages.yml) automatically runs on pushes to `main`, including merges, and also supports **Actions → Deploy J90 Laboratory → Run workflow** for manual publication.

The workflow uses Node.js 22 and runs `npm test`, the original experiment smoke test, and the v0.2 controls report. Pull requests run validation without publishing. Pushes to `main` and manual dispatches package a minimal `_site` containing the static browser files, shared adversarial oracle, and attribution page, then deploy **only after validation passes**. The deployment job alone receives Pages write / OIDC permissions. No npm dependencies or build tool are needed. The published address is [https://qsolkcb.github.io/J90/](https://qsolkcb.github.io/J90/).

If this is the first deployment, merge the workflow PR, then check **Actions → Deploy J90 Laboratory** for its result and **Settings → Pages** for the site URL. The workflow cannot deploy from a PR branch until the workflow has reached `main`; the first merge automatically triggers publication.

## Reproducibility and scientific scope

- Deterministic closed-form linear evolution, finite-number validation, pure functions.
- Tests for quarter-turn algebra, energy, damping, checkpoint reproducibility, tampering, interruption, and negative cases.
- A seven-case falsification registry and 24-point deterministic boundary sweep; a separate scalar analytical oracle checks numerical agreement within a declared absolute/relative tolerance.
- Explicit optional observation channels (clock, sensor, recorded interruption) that never read a hidden wall clock or infer awareness from a signal.
- See [Adversarial Protocol v0.2](docs/ADVERSARIAL.md) for formulas, known confounders, and evidence limitations.
- No reliance on presumed "emergence"; no claim that a geometrical rotation proves consciousness, new physics, or equivalence of unrelated mathematical transforms.
- Checkpoints are integrity receipts, not cryptographic proof of physical truth.
- See [experiment protocol](docs/EXPERIMENTS.md), [attribution](docs/ATTRIBUTION.md), [invariants](docs/INVARIANTS.md), and [roadmap](docs/ROADMAP.md).

## Credit and provenance

**Project and independent implementation:** QSOL-IMC (Trent Slade).

**Conceptual prompt and research inspiration:** Robert Dumont ([@Voltardark](https://x.com/Voltardark)), particularly his public comment about a 90° geometrically inverse counterpart, maintained oscillation, and a system's inability to observe an interruption without an external signal, alongside his advertised *The Law of Dimensional Transposition — The 90° Joints as a Universal Operator J(θ), Version 4.0* (October 2026; described as AMENRA S-DMT / USM Collective work).

This is an **independent exploration**, not a reproduction, endorsement, validation, or collaboration claimed on Robert's behalf. See [ATTRIBUTION.md](docs/ATTRIBUTION.md) for source/verification limitations.

> **Correctness outranks a compelling story.** If an experiment returns an ordinary trigonometric result, we report an ordinary trigonometric result.
