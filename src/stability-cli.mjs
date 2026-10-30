#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonical } from './checkpoint.mjs';
import { realOrbit, realAxisSweep, derivativeTrace } from './stability.mjs';
import { state } from './core.mjs';

const PYTHON = fileURLToPath(new URL('../scripts/real_axis_oracle.py', import.meta.url));
const probes = [
  { id: 'fixed-zero', c: 0, burnIn: 160, samples: 32 },
  { id: 'period-two', c: -1, burnIn: 160, samples: 32 },
  { id: 'period-two-near', c: -1.2, burnIn: 160, samples: 32 },
  { id: 'period-four', c: -1.4, burnIn: 160, samples: 32 },
  { id: 'escape', c: 0.5, burnIn: 160, samples: 32 }
];
if (process.argv.slice(2).length) {
  if (process.argv.length === 3 && ['-h','--help'].includes(process.argv[2])) {
    console.log('Usage: npm run stability  # fixed real-axis and tangent sweeps, independent Python check');
  } else {
    console.error('J90 stability: unknown options'); process.exitCode = 1;
  }
} else {
  try {
    const request = { protocol: 'j90-real-axis-v1', cases: probes };
    const proc = spawnSync('python3', [PYTHON], {
      input: JSON.stringify(request), encoding: 'utf8', timeout: 10000,
      maxBuffer: 1024 * 1024, shell: false
    });
    if (proc.error || proc.signal || proc.status !== 0) {
      throw new Error('independent Python comparison failed: ' +
        (proc.error?.message || proc.stderr || proc.signal || proc.status));
    }
    const response = JSON.parse(proc.stdout);
    if (response.protocol !== request.protocol || response.runtime !== 'python-stdlib' ||
        !Array.isArray(response.cases) || response.cases.length !== probes.length) {
      throw new TypeError('bad Python oracle response');
    }
    const tolerance = 1e-9;
    const comparisons = probes.map((input, i) => {
      const js = realOrbit(input), py = response.cases[i];
      if (py.id !== input.id || typeof py.escaped !== 'boolean' ||
          py.escaped !== js.escaped || py.escapeIteration !== js.escapeIteration ||
          !Array.isArray(py.tail) || py.tail.length !== js.tail.length) {
        throw new Error('Python orbit metadata disagreement: ' + input.id);
      }
      const maxResidual = js.tail.reduce((max, x, k) => {
        const y = py.tail[k];
        if (typeof y !== 'number' || !Number.isFinite(y)) throw new TypeError('bad oracle number');
        return Math.max(max, Math.abs(x-y));
      }, 0);
      return { id: input.id, expectedPeriodCandidate: js.candidatePeriod,
        maxResidual, passed: maxResidual <= tolerance };
    });
    const sweep = realAxisSweep();
    const derivative = [
      derivativeTrace({ initial: state(1,0), c: state(0,0), steps: 6 }),
      derivativeTrace({ initial: state(0.5,0), c: state(0,0), steps: 4 })
    ];
    const report = {
      protocol: 'j90-stability-v1', version: '0.3.1',
      realAxis: { parameters: { cMin: sweep.cMin, cMax: sweep.cMax, steps: sweep.steps,
          burnIn: sweep.burnIn, samples: sweep.samples },
        escaped: sweep.escaped, notEscapedWithinBudget: sweep.notEscapedWithinBudget,
        periodCandidateCounts: sweep.periodCandidateCounts,
        sampledTailSHA256: createHash('sha256').update(canonical(sweep.rows)).digest('hex') },
      independentOracle: { runtime: 'python-stdlib', tolerance,
        comparisons, pass: comparisons.every(row => row.passed) },
      derivative, caution: 'Finite-window periodic candidates and finite-time sensitivity are numerical observations, not proven bifurcation points or Lyapunov exponents.'
    };
    if (!report.independentOracle.pass) throw new Error('Python cross-check outside tolerance');
    console.log(JSON.stringify({ ...report,
      receiptSHA256: createHash('sha256').update(canonical(report)).digest('hex') }, null, 2));
  } catch (error) {
    console.error('J90 stability error: ' + error.message);
    process.exitCode = 1;
  }
}
