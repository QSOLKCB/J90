#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { state } from './core.mjs';
import { escapeTime, gridEscapeTimes, compareSensitivity } from './nonlinear.mjs';
import { canonical } from './checkpoint.mjs';

if (process.argv.slice(2).some(a => !['--help', '-h'].includes(a))) {
  console.error('J90 nonlinear: unexpected argument');
  process.exitCode = 1;
} else if (process.argv.length > 2) {
  console.log('Usage: npm run nonlinear — fixed deterministic Mandelbrot/Julia comparison and SHA-256 receipt');
} else {
  const probes = [
    { id: 'mandelbrot-origin', model: 'mandelbrot', point: state(0, 0) },
    { id: 'mandelbrot-minus-one', model: 'mandelbrot', point: state(-1, 0) },
    { id: 'mandelbrot-two', model: 'mandelbrot', point: state(2, 0) },
    { id: 'julia-fixed-point', model: 'julia', point: state(1, 0), c: state(0, 0) },
    { id: 'julia-escape', model: 'julia', point: state(2, 0), c: state(0, 0) },
    { id: 'julia-zero', model: 'julia', point: state(0, 0), c: state(-1, 0) }
  ];
  const rows = probes.map(({ id, ...parameters }) => ({ id, ...escapeTime({ ...parameters, maxIterations: 80 }) }));
  const mandelbrot = gridEscapeTimes({ model: 'mandelbrot', width: 96, height: 64, maxIterations: 64 });
  const julia = gridEscapeTimes({ model: 'julia', width: 96, height: 64, maxIterations: 64, centre: state(0, 0) });
  const grid = g => ({
    model: g.model, width: g.width, height: g.height, maxIterations: g.maxIterations,
    escaped: g.escaped, notEscaped: g.notEscaped,
    pixelsSHA256: createHash('sha256').update(Buffer.from(g.pixels.buffer)).digest('hex')
  });
  const report = { protocol: 'j90-nonlinear-comparison-v1', version: '0.3.0',
    probes: rows, grids: [grid(mandelbrot), grid(julia)], sensitivity: compareSensitivity(),
    limitations: [
      'Mandelbrot parameter c varies with each pixel; Julia initial z varies while c is fixed.',
      'Finite iteration non-escape is not proof of set membership.',
      'Quadratic iteration is not a 90-degree linear rotation or evidence of consciousness.'
    ] };
  console.log(JSON.stringify({ ...report,
    reportSHA256: createHash('sha256').update(canonical(report)).digest('hex') }, null, 2));
}
