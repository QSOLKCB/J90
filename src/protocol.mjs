import { state, checkedState, parameters, evolve, distance, energy, finite } from './core.mjs';
import { saveCheckpoint, loadCheckpoint } from './checkpoint.mjs';

export function runProtocol({
  initial = state(1, 0),
  omega = 1,
  damping = 0.05,
  before = 1,
  gap = 2,
  after = 1
} = {}) {
  checkedState(initial);
  for (const [name, value] of [['before', before], ['gap', gap], ['after', after]]) {
    finite(value, name);
    if (value < 0) throw new RangeError(name + ' must be nonnegative');
  }
  parameters(omega, damping, before + gap + after);
  const prePause = evolve(initial, { omega, damping, duration: before });
  const checkpoint = saveCheckpoint({
    state: prePause, step: 1, logicalTime: before, omega, damping
  });
  const restored = loadCheckpoint(checkpoint);

  // The logical clock is suspended. Compare with the same integration schedule
  // without the gap: this is deliberately a no-observation null model.
  const noGap = evolve(prePause, { omega, damping, duration: after });
  const resumed = evolve(restored.state, { omega, damping, duration: after });

  // This is a different model: dynamics kept running during the external gap.
  const continuous = evolve(prePause, { omega, damping, duration: gap + after });

  return {
    model: 'linear_2d_quadrature_v1',
    hypothesis: 'Without an external clock or new observations, an exact restored checkpoint contains no record of a suspended interval.',
    parameters: { omega, damping, before, gap, after },
    prePause, noGap, resumed, continuous,
    checkpoint,
    observations: {
      noClockDistance: distance(noGap, resumed),
      continuedEvolutionDistance: distance(continuous, resumed),
      prePauseEnergy: energy(prePause),
      resumedEnergy: energy(resumed),
      // This flag assumes an independent external clock is available after resume.
      externalClockRevealsGap: gap > 0
    },
    limitations: [
      'Identity after restore is a consequence of the chosen model, not evidence of awareness.',
      'The continuous model may return to an indistinguishable state at particular phases.',
      'A checksum detects accidental modification; it is not a security signature.',
      'No biological or physical claim is established by this simulation.'
    ]
  };
}
