# J90 agent instructions

This repository is an exploratory mathematical research lab. Treat claims as falsifiable hypotheses rather than conclusions.

1. **Read** README.md, docs/INVARIANTS.md, docs/EXPERIMENTS.md, and docs/ATTRIBUTION.md before changing models or experiments.
2. **Correctness before features:** never quietly reinterpret an oscillator as a conscious or biological system.
3. Maintain deterministic, dependency-free operation; no network, hidden clocks, seeded/unseeded randomness, generated artefacts in source control, or unexpected mutable state.
4. Validate numbers (including overflow), modes, and external serialized data fail-closed.
5. Preserve the precise distinction between logical time (which can be paused), wall time (external), and evolving physical dynamics (which may continue).
6. Do not change checkpoint serialization, version, hashing, or research claims without explicit versioning and tests.
7. Attribute Robert Dumont (@Voltardark) for the conceptual question and advertised dimensional-transposition publication, without assigning him authorship of implementation or implying approval.
8. No unlicensed third-party assets, no borrowed book or paper content, and no implicit scientific endorsement.
9. Use Node's built-in tests; run the full suite on every change. The only permitted GitHub Actions automation is the explicit GitHub Pages test/build/deploy workflow in `.github/workflows/deploy-pages.yml`. Keep the build fail-closed, static-only, and free of runtime dependencies, with deployment privileges restricted to its deploy job.
10. Changes beyond scope require separate, reviewable PRs. Include falsification cases and null baselines for new hypotheses.
