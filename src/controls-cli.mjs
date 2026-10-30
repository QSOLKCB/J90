#!/usr/bin/env node
import { NULL_MODELS, getNullModel, evaluateControl, runNullRegistry, runBoundarySweep } from './adversarial.mjs';
import { runProtocol } from './protocol.mjs';

// Reports contain both the independent analytical comparison and v0.1's
// integrity-checked checkpoint replay. No wall clock, randomness, or network.
const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
  console.log('J90 controls: node src/controls-cli.mjs [--all | --case CASE_ID]');
  console.log('Cases: ' + NULL_MODELS.map(item => item.id).join(', '));
  process.exit(0);
}
try {
  if (args.length !== 0 && !(args.length === 1 && args[0] === '--all') &&
      !(args.length === 2 && args[0] === '--case')) {
    throw new Error('expected --all or --case CASE_ID');
  }
  let records;
  let sweep;
  if (args[0] === '--case') {
    const c = getNullModel(args[1]);
    records = [evaluateControl({ id: c.id, initial: c.initial,
      omega: c.omega, damping: c.damping, before: c.before,
      gap: c.gap, after: c.after })];
    sweep = [];
  } else {
    records = runNullRegistry();
    sweep = runBoundarySweep();
  }
  const registry = records.map(item => {
    const p = item.parameters;
    const replay = runProtocol(p);
    const replayMatchesOracle = Math.abs(replay.observations.continuedEvolutionDistance -
      item.oracleDistance) <= item.allowedError;
    return {
      ...item,
      checkpointReplay: {
        receipt: replay.checkpoint,
        noClockDistance: replay.observations.noClockDistance,
        agreesWithOracle: replayMatchesOracle
      }
    };
  });
  const checks = {
    registryPass: registry.every(item => item.matchesOracle &&
      item.checkpointReplay.noClockDistance === 0 &&
      item.checkpointReplay.agreesWithOracle),
    sweepPass: sweep.every(item => item.matchesOracle)
  };
  const report = {
    protocol: 'J90-v0.2.0-adversarial-controls',
    result: checks.registryPass && checks.sweepPass ? 'PASS' : 'FAIL',
    errorBudget: { absolute: 1e-12, relative: 1e-12 },
    checks, registry, sweep,
    boundaries: [
      'The analytical oracle is a consequence of the assumed linear oscillator model.',
      'A visible state difference is not proof that an interruption occurred.',
      'Clock readings, external sensors, and an explicit memory report are separate input channels.',
      'No biological life, agency, or consciousness conclusion follows.'
    ]
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
} catch (error) {
  console.error('J90 controls error: ' + error.message);
  process.exitCode = 1;
}
