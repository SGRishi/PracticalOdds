import type { Chess } from 'chess.js';

const PIECE_CP: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

export function materialCp(chess: Chess): number {
  const board = chess.board();
  let white = 0, black = 0;
  for (const row of board) for (const sq of row) if (sq) {
    const v = PIECE_CP[sq.type];
    if (sq.color === 'w') white += v; else black += v;
  }
  return white - black; // + = White ahead
}

export function isEndgame(chess: Chess): boolean {
  // Queens off & minor/rook count <= 10 total
  const board = chess.board();
  let queens = 0, others = 0;
  for (const row of board) for (const sq of row) if (sq) {
    if (sq.type === 'q') queens++;
    else others++;
  }
  return queens === 0 && others <= 10;
}
