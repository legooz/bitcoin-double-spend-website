// Precomputed illustrative curves from the real double-spend model (α = 0.2),
// generated with backend/app/probability. Used for the homepage example graphs
// so they reflect the actual model rather than fabricated shapes.

import type { ProbabilityPoint } from './types';

export const EXAMPLE_ALPHA = 0.2;

function toPoints(rows: number[][]): ProbabilityPoint[] {
  return rows.map(([elapsed_seconds, probability]) => ({ elapsed_seconds, probability }));
}

// Stuck in the mempool: 0 confirmations, so risk climbs with elapsed time.
export const exampleMempool = toPoints([
  [0, 0.25], [300, 0.321372], [600, 0.385952], [900, 0.444386], [1200, 0.49726],
  [1500, 0.545102], [1800, 0.588391], [2100, 0.627561], [2400, 0.663003], [2700, 0.695073],
  [3000, 0.72409], [3300, 0.750347], [3600, 0.774104], [3900, 0.795601], [4200, 0.815052],
  [4500, 0.832652], [4800, 0.848578], [5100, 0.862987], [5400, 0.876026], [5700, 0.887824],
  [6000, 0.898499], [6300, 0.908158], [6600, 0.916898], [6900, 0.924806], [7200, 0.931962],
]);

// Normal confirmations (~1 block / 10 min): risk decays toward zero.
export const exampleNormal = toPoints([
  [0, 0.25], [300, 0.321372], [600, 0.10963], [900, 0.138799], [1200, 0.048564],
  [1500, 0.061773], [1800, 0.02176], [2100, 0.027826], [2400, 0.009814], [2700, 0.012609],
  [3000, 0.004444], [3300, 0.005733], [3600, 0.002018], [3900, 0.002612], [4200, 0.000918],
  [4500, 0.001191], [4800, 0.000418], [5100, 0.000544], [5400, 0.00019], [5700, 0.000248],
  [6000, 0.000087], [6300, 0.000114], [6600, 0.00004], [6900, 0.000052], [7200, 0.000018],
]);

// Slow to confirm, spanning the first 5 hours. Modeled on the real block gaps
// of block 16589 (June 2009), when the tiny early network mined blocks hours
// apart: conf 1 at t=0, conf 2 after ~116 min, conf 3 after ~151 min, then
// stuck at 3 for ~20 h. Each confirmation dips the risk, but the long waits at
// a fixed confirmation count push it back up, so it climbs even at 3 confs.
export const exampleSlow = toPoints([
  [0, 0.0625], [900, 0.138799], [1800, 0.238524], [2700, 0.344406], [3600, 0.446556],
  [4500, 0.539794], [5400, 0.621879], [6300, 0.692328], [7200, 0.510633], [8100, 0.580008],
  [9000, 0.642933], [9900, 0.489487], [10800, 0.550611], [11700, 0.607717], [12600, 0.660197],
  [13500, 0.707738], [14400, 0.750268], [15300, 0.787894], [16200, 0.820857], [17100, 0.849479],
  [18000, 0.874136],
]);

// Fast confirmations (~1 block / 3 min): risk collapses almost immediately.
export const exampleFast = toPoints([
  [0, 0.25], [300, 0.083852], [600, 0.00711], [900, 0.0006], [1200, 0.000203],
  [1500, 0.000017], [1800, 0.000001], [2100, 0], [2400, 0], [2700, 0],
  [3000, 0], [3300, 0], [3600, 0], [3900, 0], [4200, 0],
  [4500, 0], [4800, 0], [5100, 0], [5400, 0], [5700, 0],
  [6000, 0], [6300, 0], [6600, 0], [6900, 0], [7200, 0],
]);
