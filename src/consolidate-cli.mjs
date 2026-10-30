#!/usr/bin/env node
// Deterministic evidence emission; --out creates a new directory and never overwrites.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runConsolidation } from './consolidation.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log('Usage: npm run consolidate [-- --out DIR]');
  console.log('The optional output directory must be a new, simple local directory name.');
  process.exit(0);
}
try {
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--out' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(args[1]) ||
      args[1] === '.' || args[1] === '..')) {
    throw new TypeError('expected --out and a simple local directory name');
  }
  const report = runConsolidation();
  const json = JSON.stringify(report, null, 2) + '\n';
  if (args.length) {
    mkdirSync(args[1]); // fail closed if already present
    const instructions = [
      'J90 v0.3.3 — Nonlinear evidence consolidation',
      'Reproduce from this repository revision with Node.js 20+ and Python 3.11+:',
      '    npm test',
      '    npm run consolidate',
      'Verify SHA256SUMS.txt using sha256sum -c SHA256SUMS.txt',
      'The manifest includes individual source SHA-256 hashes and grid hashes.',
      'GitHub Actions artifacts are temporary; copy to a durable archive deliberately.',
      'A SHA-256 digest is not a trusted signature, scientific proof or evidence of consciousness.',
      ''
    ].join('\n');
    const sha = content => createHash('sha256').update(content, 'utf8').digest('hex');
    writeFileSync(args[1] + '/manifest.json', json, { flag: 'wx' });
    writeFileSync(args[1] + '/REPRODUCE.txt', instructions, { flag: 'wx' });
    writeFileSync(args[1] + '/SHA256SUMS.txt',
      sha(json) + '  manifest.json\n' + sha(instructions) + '  REPRODUCE.txt\n', { flag: 'wx' });
  }
  process.stdout.write(json);
  if (report.result !== 'PASS') process.exitCode = 1;
} catch (err) {
  console.error('J90 consolidation error: ' + err.message);
  process.exitCode = 1;
}
