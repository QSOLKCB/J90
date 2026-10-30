#!/usr/bin/env node
import { runObservationMatrix } from './observations.mjs';
import { runNumericStress } from './numeric-stress.mjs';
import { errorBudget } from './adversarial.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log('J90 evidence: node src/evidence-cli.mjs [--full] [--atol N] [--rtol N]');
  console.log('Synthetic observational matrix and deterministic numerical stress; no live sensors or clocks.');
  process.exit(0);
}
try {
  const flags = new Set();
  let full = false;
  const b = { absolute: 1e-12, relative: 1e-12 };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flags.has(flag)) throw new TypeError('duplicate flag: ' + flag);
    flags.add(flag);
    if (flag === '--full') { full = true; continue; }
    if (!['--atol', '--rtol'].includes(flag)) throw new TypeError('unknown option: ' + flag);
    if (++i >= args.length || args[i].trim() === '') throw new TypeError('missing tolerance');
    b[flag === '--atol' ? 'absolute' : 'relative'] = Number(args[i]);
  }
  const budget = errorBudget(b);
  const access = runObservationMatrix(budget);
  const stress = runNumericStress(budget);
  const pass = stress.oracleMatches === stress.count && access.projectionCount === 35;
  const report = {
    protocol: 'j90-v0.2.2-evidence-and-stress',
    result: pass ? 'PASS' : 'FAIL',
    observation: full ? access : {
      caseCount: access.caseCount, profileCount: access.profileCount,
      projectionCount: access.projectionCount, reportSHA256: access.reportSHA256,
      profileExamples: access.cases[0].projections.map(p => ({
        role: p.role, channels: p.channels, observation: p.observation
      }))
    },
    numeric: full ? stress : {
      count: stress.count, oracleMatches: stress.oracleMatches,
      exactFloatAgreements: stress.exactFloatAgreements,
      underflowedGainCases: stress.underflowedGainCases,
      groups: stress.groups, reportSHA256: stress.reportSHA256
    },
    caution: 'Synthetic source-labelled observations and finite numerical tests do not establish event authenticity, causality, life or awareness.'
  };
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error('J90 evidence error: ' + error.message);
  process.exitCode = 1;
}
