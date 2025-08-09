import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { computePOM } from './pom';

describe('computePOM', () => {
  it('sums probabilities to 1 at start position', () => {
    const chess = new Chess();
    const out = computePOM({
      evalCp: 0,
      topk: [],
      legalCount: chess.moves().length,
      eloWhite: 1800,
      eloBlack: 1800,
      timeControl: 'Rapid',
      chess,
      sideToMove: 'w',
      useBookHeuristics: true,
    });
    expect(out.pW + out.pD + out.pB).toBeCloseTo(1, 6);
  });
});
