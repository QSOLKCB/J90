# J90 invariants and contracts

**Mathematics:** The base generator J has entries [[0,-1],[1,0]]. In exact arithmetic, J^2=-I, J^4=I; 90-degree turn is (-y,x). For gamma=0, x^2+y^2 is conserved. For gamma>=0, E(t)=E(0) exp(-2 gamma t) in the continuous model.

**Implementation:** No randomness, networking, asynchronous inputs, global simulation state or implicit wall clock. The browser is a view, not an alternate mathematical authority. All numeric inputs must be finite; time and damping nonnegative. Outputs can be subject to IEEE 754 rounding and are not bitwise portable across arbitrary JavaScript engines.

**Time:** Pausing logical time means the state does not evolve. Letting a physical system run during a "gap" is a different experiment. Independent clock observations are input data and cannot be inferred from a state that contains no clock.

**Checkpoint:** Version 1 is canonical JSON with lexicographically sorted keys, SHA-256 over payload, and a strict canonical envelope. A digest checks file integrity, not provenance or scientific accuracy. The representation is JavaScript-specific; cross-language canonical JSON must be separately specified before interoperability is claimed.

**Cross-runtime replay:** The Node.js emitter produces v1 canonical checkpoints; the Python stdlib consumer checks integrity over the original payload bytes and preserves the v1 field/schema ordering. Python does not claim to regenerate JavaScript number spellings byte for byte. Mathematical parity uses independent operations and declared finite absolute/relative error budgets, never cross-runtime byte equality. Subprocesses have fixed argument lists, disabled shells, bounded input/output and no caller-controlled executable paths.

**Evidence:** Distinguish identities, simulation outcomes, conjectures, and externally measured empirical evidence. Null comparisons are mandatory. Reproducing a known identity does not support an extraordinary inference.

**Research and ethics:** No attribution of consciousness, sentience, or agency without independently defined operational evidence. Cite inspirations accurately; do not imply external endorsement.
