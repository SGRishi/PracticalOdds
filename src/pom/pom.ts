import type { EngineLine } from '../state/store';
import type { Chess } from 'chess.js';
import { stddev, clamp, bishopsOppositeColors, passedPawnFeatures } from './heuristics';
import { materialCp, isEndgame } from '../utils/material';

export type TimeControl = 'Bullet' | 'Blitz' | 'Rapid' | 'Classical';

export interface POMInputs {
  evalCp?: number; // from best line
  wdlEngine?: [number, number, number];
  topk: EngineLine[];
  legalCount: number;
  eloWhite: number;
  eloBlack: number;
  timeControl: TimeControl;
  chess: Chess; // current position
  sideToMove: 'w' | 'b';
  lastEvalCp?: number; // for volatility
  useBookHeuristics: boolean;
}

export interface POMOutput { pW: number; pD: number; pB: number; why: string[]; }

const DRAW_BASE: Record<TimeControl, number> = {
  Bullet: 0.20, Blitz: 0.28, Rapid: 0.33, Classical: 0.38,
};

function baseMapping(evalCp: number | undefined, wdlEngine: [number, number, number] | undefined, tc: TimeControl): { pW: number; pD: number; pB: number; why: string[] } {
  if (wdlEngine) {
    const sum = wdlEngine[0] + wdlEngine[1] + wdlEngine[2] || 1;
    return { pW: wdlEngine[0] / sum, pD: wdlEngine[1] / sum, pB: wdlEngine[2] / sum, why: ['Engine WDL baseline'] };
  }
  const baseDraw = DRAW_BASE[tc];
  const s = clamp(evalCp ?? 0, -1500, 1500);
  const decisiveMass = 1 - (baseDraw * Math.exp(-Math.abs(s) / 350));
  const pWraw = decisiveMass * (1 / (1 + Math.exp(-s / 120)));
  const pBraw = decisiveMass - pWraw;
  const pDraw = 1 - decisiveMass;
  return { pW: pWraw, pD: pDraw, pB: pBraw, why: ['cp→WDL mapping baseline'] };
}

function renorm(pW: number, pD: number, pB: number) {
  let sum = pW + pD + pB; if (sum <= 0) return { pW: 1/3, pD: 1/3, pB: 1/3 };
  return { pW: pW / sum, pD: pD / sum, pB: pB / sum };
}

export function computePOM(inp: POMInputs): POMOutput {
  let why: string[] = [];
  let { pW, pD, pB, why: w0 } = baseMapping(inp.evalCp, inp.wdlEngine, inp.timeControl);
  why.push(...w0);

  // Elo adjustment (nudge decisive odds toward favorite):
  const d = inp.eloWhite - inp.eloBlack;
  const Ewhite = 1 / (1 + 10 ** (-d / 400));
  const Eblack = 1 - Ewhite;
  const adj = 0.18;
  pW *= (1 + adj * (Ewhite - 0.5));
  pB *= (1 + adj * (Eblack - 0.5));
  ({ pW, pD, pB } = renorm(pW, pD, pB));
  if (Math.abs(d) >= 100) why.push(`Elo gap favors ${d>0?'White':'Black'} (~${Math.round(Math.abs(d))})`);

  // Winning-moves ratio
  const best = inp.topk.find(l => l.multipv === 1);
  const bestCp = best?.cp ?? (inp.evalCp ?? 0);
  const delta = 50; // cp window
  let rWin = 0;
  if (inp.topk.length) {
    const good = inp.topk.filter(l => (l.cp ?? -99999) >= (bestCp - delta)).length;
    rWin = good / Math.max(1, inp.legalCount);
    const f = clamp(1 + 0.6 * (rWin - 0.15), 0.7, 1.3);
    if (bestCp >= 0) { pW *= f; } else { pB *= f; }
    ({ pW, pD, pB } = renorm(pW, pD, pB));
    why.push(`${(rWin*100).toFixed(0)}% of moves keep the edge`);
  }

  // Sharpness / Volatility
  const topCps = inp.topk.map(l => (l.cp ?? 0));
  const sharp = stddev(topCps);
  const vol = inp.lastEvalCp == null ? 0 : Math.abs((inp.evalCp ?? 0) - inp.lastEvalCp);
  const decisiveBoost = clamp((sharp / 80) + (vol / 100), 0, 0.20);
  const mass = 1 - pD; // current decisive mass
  const targetMass = clamp(mass * (1 + decisiveBoost), 0, 0.98);
  const scale = (1 - pD) === 0 ? 1 : targetMass / (1 - pD);
  pW *= scale; pB *= scale; pD = 1 - (pW + pB);
  ({ pW, pD, pB } = renorm(pW, pD, pB));
  if (decisiveBoost > 0.01) why.push(`Sharp/volatile position (↑ decisive by ${(decisiveBoost*100).toFixed(0)}%)`);

  // Convertibility heuristics
  const mat = materialCp(inp.chess); // + = White material up
  const endg = isEndgame(inp.chess);
  if (endg && Math.abs(mat) > 200) {
    const leadSide = mat > 0 ? 'White' : 'Black';
    const bump = clamp((Math.abs(mat) - 200) / 600, 0, 0.25);
    if (mat > 0) pW *= (1 + bump); else pB *= (1 + bump);
    ({ pW, pD, pB } = renorm(pW, pD, pB));
    why.push(`${leadSide} material edge in endgame (+${Math.round(bump*100)}% win)`);
  }
  // Drawish templates
  if (bishopsOppositeColors(inp.chess)) {
    pD += 0.12; pW -= 0.06; pB -= 0.06;
    ({ pW, pD, pB } = renorm(pW, pD, pB));
    why.push('Opposite-colored bishops endgame (drawish)');
  }
  // Passed pawns
  const pass = passedPawnFeatures(inp.chess);
  const passerBoost = (pass.whitePassers || pass.blackPassers) ? clamp(0.05 + 0.03 * (pass.connected ? 1 : 0) + 0.02 * (pass.outside ? 1 : 0), 0, 0.12) : 0;
  if (passerBoost > 0) {
    if (bestCp >= 0) { pW += passerBoost; pD -= passerBoost; } else { pB += passerBoost; pD -= passerBoost; }
    ({ pW, pD, pB } = renorm(pW, pD, pB));
    why.push('Passed pawns improve convertibility');
  }

  // Opening drawishness (lightweight heuristic only)
  if (inp.useBookHeuristics) {
    const ply = inp.chess.history().length;
    if (ply <= 14 && Math.abs(inp.evalCp ?? 0) < 25) {
      // early, equal → slightly more draws
      const bump = 0.07;
      pD = Math.max(pD, Math.min(0.90, pD + bump));
      ({ pW, pD, pB } = renorm(pW, pD, pB));
      why.push('Book-like equality (drawish opening)');
    }
  }

  // Mate handling
  const mate = (best?.mate ?? undefined);
  if (mate != null) {
    const caps = { Bullet: 0.95, Blitz: 0.97, Rapid: 0.98, Classical: 0.99 };
    if (mate > 0) { pW = Math.max(pW, caps[inp.timeControl]); pD = 1 - pW; pB = 0.001; }
    if (mate < 0) { pB = Math.max(pB, caps[inp.timeControl]); pD = 1 - pB; pW = 0.001; }
    ({ pW, pD, pB } = renorm(pW, pD, pB));
    why.push(`Mate in ${Math.abs(mate)} detected`);
  }

  // Clip floors/ceilings (non-mate)
  pW = clamp(pW, 0.01, 0.99); pB = clamp(pB, 0.01, 0.99); pD = clamp(pD, 0.05, 0.99);
  ({ pW, pD, pB } = renorm(pW, pD, pB));

  return { pW, pD, pB, why };
}

export function ema(prev: [number, number, number] | null, cur: [number, number, number], alpha = 0.3): [number, number, number] {
  if (!prev) return cur; const [pw0, pd0, pb0] = prev; const [pw, pd, pb] = cur;
  const out: [number, number, number] = [pw0 + alpha * (pw - pw0), pd0 + alpha * (pd - pd0), pb0 + alpha * (pb - pb0)];
  const s = out[0] + out[1] + out[2];
  return [out[0]/s, out[1]/s, out[2]/s];
}
