#!/usr/bin/env node
import { errorBudget } from './adversarial.mjs';
import { runCrossRuntime } from './cross-runtime.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
  console.log('J90 cross-runtime replay: node src/cross-runtime-cli.mjs [--atol N] [--rtol N]');
  console.log('Runs a fixed Node.js/Python 3.11+ checkpoint corpus; no caller-provided executables or files.');
  process.exit(0);
}
try {
  if (args.length % 2) throw new TypeError('expected --name value pairs');
  const values = { absolute: 1e-12, relative: 1e-12 };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--atol', '--rtol'].includes(flag) || seen.has(flag)) {
      throw new TypeError('unknown or duplicate option: ' + flag);
    }
    seen.add(flag);
    const raw = args[i + 1];
    if (typeof raw !== 'string' || raw.trim() === '') throw new TypeError('missing numeric value');
    const parsed = Number(raw);
    values[flag === '--atol' ? 'absolute' : 'relative'] = parsed;
  }
  const report = runCrossRuntime(errorBudget(values));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('J90 cross-runtime error: ' + error.message);
  process.exitCode = 1;
}
