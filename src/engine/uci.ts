export type WorkerFromMain =
  | { type: 'init' }
  | { type: 'newgame' }
  | { type: 'stop' }
  | { type: 'quit' }
  | { type: 'position'; fen: string; movesUci?: string[] }
  | { type: 'go'; depth?: number; movetime?: number; multipv?: number }
  | { type: 'setoption'; name: string; value: string | number };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'log'; text: string }
  | { type: 'bestmove'; move: string }
  | { type: 'info'; text: string }
  | { type: 'parsedInfo'; line: ParsedInfo };

export interface ParsedInfo {
  multipv?: number;
  depth?: number;
  nps?: number;
  cp?: number;
  mate?: number;
  pv?: string[];
  wdl?: [number, number, number];
}
