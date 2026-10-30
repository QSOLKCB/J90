// Deterministic adversarial float64 sweep: no random sampling or hidden time.
import { createHash } from 'node:crypto';
import { state } from './core.mjs';
import { canonical } from './checkpoint.mjs';
import { evaluateControl, errorBudget } from './adversarial.mjs';

export const STRESS_GRID = Object.freeze({
  omega: Object.freeze([0, 1e-12, 1e-6, Math.PI / 2, 2 * Math.PI, 1e6]),
  damping: Object.freeze([0, 1e-12, 0.05, 1, 710]),
  gap: Object.freeze([0, 1e-9, 0.125, 1, 10]),
  amplitudes: Object.freeze([
    Object.freeze({ id: 'unit', x: 1, y: 0 }),
    Object.freeze({ id: 'tiny', x: 1e-150, y: -1e-150 }),
    Object.freeze({ id: 'subnormal', x: Number.MIN_VALUE, y: 0 })
  ])
});
const DEFAULT_BUDGET = Object.freeze({ absolute: 1e-12, relative: 1e-12 });
export function runNumericStress(requestedBudget = DEFAULT_BUDGET) {
  const budget = errorBudget(requestedBudget);
  const cases = [];
  const groupStats = new Map();
  for (const input of STRESS_GRID.amplitudes) {
    const group = { id: input.id, cases: 0, oracleMatches: 0,
      strictZeroMatches: 0, zeroObserved: 0, underflowedGain: 0, maxError: 0 };
    groupStats.set(input.id, group);
    for (const omega of STRESS_GRID.omega) {
      for (const damping of STRESS_GRID.damping) {
        for (const gap of STRESS_GRID.gap) {
          const id = input.id + '-' + String(cases.length).padStart(3, '0');
          const parameters = { id, initial: state(input.x, input.y),
            omega, damping, before: 0.125, gap, after: 0.25 };
          const standard = evaluateControl({ ...parameters, budget });
          const strict = evaluateControl({ ...parameters,
            budget: { absolute: 0, relative: 0 } });
          const underflowedGain = damping * gap > 0 && Math.exp(-damping * gap) === 0;
          const row = {
            id, amplitudeClass: input.id, omega, damping, gap,
            predicted: standard.oracleDistance, observed: standard.observedDistance,
            residual: standard.absoluteError, allowance: standard.allowedError,
            matchesOracle: standard.matchesOracle, exactFloatAgreement: strict.matchesOracle,
            observableDifference: standard.observableDifference, underflowedGain
          };
          cases.push(row);
          group.cases++;
          group.oracleMatches += Number(row.matchesOracle);
          group.strictZeroMatches += Number(row.exactFloatAgreement);
          group.zeroObserved += Number(row.observed === 0);
          group.underflowedGain += Number(underflowedGain);
          group.maxError = Math.max(group.maxError, row.residual);
        }
      }
    }
  }
  const groups = [...groupStats.values()];
  const report = {
    protocol: 'j90-float-boundaries-v1', version: '0.2.2',
    tolerance: budget, cases,
    count: cases.length, oracleMatches: cases.filter(r => r.matchesOracle).length,
    exactFloatAgreements: cases.filter(r => r.exactFloatAgreement).length,
    underflowedGainCases: cases.filter(r => r.underflowedGain).length,
    groups,
    interpretation: [
      'Underflow and phase aliasing can hide a difference even when a continuous real-valued equation differs.',
      'A zero-tolerance mismatch is a numerical observation, not evidence of consciousness or a new physical law.',
      'This sweep samples specified IEEE-754 JavaScript inputs; it does not prove global numerical stability.'
    ]
  };
  const receipt = createHash('sha256').update(canonical(report), 'utf8').digest('hex');
  return { ...report, reportSHA256: receipt };
}
