#!/usr/bin/env node
import { runProtocol } from './protocol.mjs';

const defaults = { omega: 1, damping: 0.05, before: 1, gap: 2, after: 1 };
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('J90 experiment: node src/cli.mjs [--omega N] [--damping N] [--before N] [--gap N] [--after N]');
  process.exit(0);
}
try {
  if (args.length % 2 !== 0) throw new Error('expected --name value pairs');
  const options = { ...defaults };
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const key = flag.startsWith('--') ? flag.slice(2) : '';
    if (!Object.hasOwn(options, key)) throw new Error('unknown option: ' + flag);
    if (args[i + 1].trim() === '') throw new Error('empty value: ' + flag);
    const number = Number(args[i + 1]);
    if (!Number.isFinite(number)) throw new Error('nonfinite value: ' + flag);
    options[key] = number;
  }
  console.log(JSON.stringify(runProtocol(options), null, 2));
} catch (err) {
  console.error('J90 error: ' + err.message);
  process.exitCode = 1;
}
