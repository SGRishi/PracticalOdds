import { create } from 'zustand';

export type TimeControl = 'Bullet' | 'Blitz' | 'Rapid' | 'Classical';

export interface EngineLine {
  multipv: number;
  depth?: number;
  nps?: number;
  cp?: number; // centipawns from White POV
  mate?: number; // mate in N (positive = mate for White)
  pv?: string[]; // SAN or UCI moves (we’ll keep PV in SAN-ish later)
  wdl?: [number, number, number]; // white, draw, black at current depth (if supported)
}

export interface AppState {
  whiteElo: number;
  blackElo: number;
  timeControl: TimeControl;
  useBookHeuristics: boolean;
  positionFEN: string;
  movesSAN: string[];
  legalCount: number;

  engineOn: boolean;
  engineDepth: number;
  topk: EngineLine[]; // MultiPV lines sorted by multipv
  lastEvalCp?: number;
  lastDepth?: number;

  pW: number; pD: number; pB: number; // last displayed probs (smoothed)
  why: string[]; // explanations

  set: (p: Partial<AppState>) => void;
}

export const useApp = create<AppState>((set) => ({
  whiteElo: 1800,
  blackElo: 1800,
  timeControl: 'Rapid',
  useBookHeuristics: true,
  positionFEN: 'startpos',
  movesSAN: [],
  legalCount: 20,

  engineOn: true,
  engineDepth: 0,
  topk: [],
  lastEvalCp: undefined,
  lastDepth: undefined,

  pW: 0.33, pD: 0.34, pB: 0.33,
  why: [],

  set: (p) => set(p),
}));
