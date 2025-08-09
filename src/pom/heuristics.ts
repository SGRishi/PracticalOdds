import type { Chess } from 'chess.js';

export function stddev(nums: number[]): number {
  if (nums.length === 0) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function countLegalMoves(chess: Chess): number {
  return chess.moves().length;
}

export function bishopsOppositeColors(chess: Chess): boolean {
  // exactly 1 bishop each, on opposite colors, queens off, ≤8 pawns
  const board = chess.board();
  let wb = 0, bb = 0, wColor = -1, bColor = -1, queens = 0, pawns = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c];
    if (!sq) continue;
    if (sq.type === 'q') queens++;
    if (sq.type === 'p') pawns++;
    if (sq.type === 'b') {
      const light = (r + c) % 2 === 0 ? 1 : 0;
      if (sq.color === 'w') { wb++; wColor = light; } else { bb++; bColor = light; }
    }
  }
  return wb === 1 && bb === 1 && wColor !== -1 && bColor !== -1 && wColor !== bColor && queens === 0 && pawns <= 8;
}

export function passedPawnFeatures(chess: Chess): { whitePassers: number; blackPassers: number; connected: boolean; outside: boolean } {
  const board = chess.board();
  const files = 'abcdefgh'.split('');
  const whiteP: [number, number][] = []; // [fileIndex, rank]
  const blackP: [number, number][] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = board[r][c];
    if (!sq || sq.type !== 'p') continue;
    if (sq.color === 'w') whiteP.push([c, r]); else blackP.push([c, r]);
  }
  function isPassed(c: number, r: number, color: 'w'|'b') {
    if (color === 'w') {
      for (let rr = r - 1; rr >= 0; rr--) for (let cc = c - 1; cc <= c + 1; cc++) {
        if (cc < 0 || cc > 7) continue;
        const sq = board[rr][cc];
        if (sq && sq.type === 'p' && sq.color === 'b') return false;
      }
      return true;
    } else {
      for (let rr = r + 1; rr <= 7; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
        if (cc < 0 || cc > 7) continue;
        const sq = board[rr][cc];
        if (sq && sq.type === 'p' && sq.color === 'w') return false;
      }
      return true;
    }
  }
  const wPassed = whiteP.filter(([c, r]) => isPassed(c, r, 'w')).length;
  const bPassed = blackP.filter(([c, r]) => isPassed(c, r, 'b')).length;
  const connected = wPassed >= 2 || bPassed >= 2; // coarse
  const outside = (wPassed >= 1 || bPassed >= 1); // coarse flag
  return { whitePassers: wPassed, blackPassers: bPassed, connected, outside };
}
