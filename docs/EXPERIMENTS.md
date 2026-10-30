# Experimental protocol v1 — pause, restore, and observation

## System

State s=(x,y). Evolution solves ds/dt=(omega J - gamma I)s with omega in radians/time, gamma>=0, and finite nonnegative durations. The solution is closed form; this is not an Euler integrator.

## Arms

1. **No-gap reference:** evolve for BEFORE, then AFTER.
2. **Checkpoint/resume (no-clock):** evolve BEFORE, serialize/restore state, skip GAP **without advancing the model**, evolve AFTER.
3. **Continued evolution:** evolve BEFORE, then GAP+AFTER. Unlike the pause arm, dynamics never stop.
4. **Independent clock:** a separate observer is explicitly told GAP duration and thus can distinguish the interrupted schedule. The model state itself receives no such signal.

The observable is Euclidean distance between final 2D states. Also report energy and the actual canonical SHA-256 checkpoint.

## Predictions and falsification

- **H0, no-clock pause:** Reference and restored state are identical by construction. Nonzero output distance indicates a bug or an uncontrolled observation. This is a model identity, not a discovery about awareness.
- **H1, continued dynamics:** May differ, depending on omega, damping and gap. Not *guaranteed*: phase aliasing and gamma=0 can produce matching endpoints; gamma>0 and nonzero initial amplitude produce decay for any positive gap.
- **H2, external signal:** An independent clock can report gap>0 because the value is given to it; this is not inference from the oscillator.
- **Null baselines:** gap=0, omega=0, gamma=0, initial=(0,0), and integral phase turns must be considered before interpreting a result.
- **Unsupported extrapolation:** No state has beliefs, memory of subjective experience, biological metabolism, or awareness. An oscillator cannot establish these properties.

## Reproduce

~~~sh
node --test
node src/cli.mjs --omega 1 --damping 0.05 --before 1 --gap 2 --after 1
node src/cli.mjs --omega 0 --damping 0 --before 1 --gap 2 --after 1
node src/cli.mjs --omega 6.283185307179586 --damping 0 --before 1 --gap 1 --after 1
~~~

Reports are serialized to stdout, with errors to stderr and a nonzero exit code. Compare reports only with equivalent numeric inputs and runtime semantics.

## Limitations

This is a deliberately small counterexample/control laboratory. Distinctions between mathematical operators such as Fourier transform, Hodge duality, and Hopf fibrations cannot be inferred from common "90°" terminology. Future formalizations must specify domains, codomains, inverses, invariant quantities, and failure cases separately.
