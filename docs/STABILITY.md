# v0.3.1 — Finite-window real-axis dynamics and sensitivity

The real quadratic map x(n+1)=x(n)^2+c is studied with x(0)=0. The 241-point fixed sweep uses c in [-2, 0.35], 160 burn-in steps and 32 post-burn-in samples. Escapes above |x|=2 are recorded separately.

Candidate periods 1, 2, 4 and 8 require agreement between successive tail values, including at least four repeats of the candidate period, with a 1e-8 relative-scale threshold. No finite observation proves an attracting periodic orbit, exact bifurcation location, or chaos. An absent candidate is reported as undetermined.

Sensitivity is evaluated by two deliberately different methods: tangent recurrence d(n+1)=2*z(n)*d(n) with d(0)=1, and an independently propagated initial-value perturbation. The reported finite-time log gain log(|d(n)|)/n is NOT a global Lyapunov exponent. Epsilon and update counts are bounded; unresolved perturbations fail closed.

A separate Python standard-library implementation computes five fixed real-axis orbits, independently of JavaScript code. The Node CLI checks escaped status, update counts and 32 tail samples with an explicit 1e-9 absolute tolerance. The Python check is not a mathematically independent proof of all periodicity classifications. SHA-256 receipts cover canonical Node summaries; they are reproducibility hashes rather than signed scientific provenance.

Run:
    npm test
    npm run stability

The browser plots a separate sampled real-axis diagram and selected candidate period. No changes are made to the original oscillator, checkpoint version, Robert Dumont attribution or observation-access contracts. This experiment establishes no life, consciousness or general dimensional-transposition claim.
