/// <reference lib="webworker" />
import type { WorkerFromMain, WorkerToMain, ParsedInfo } from './uci';

// Paths: ensure these exist in public/engine/
const STOCKFISH_JS_URL = self.location.origin + '/engine/stockfish.js';

let engine: any | null = null;

function send(msg: WorkerToMain) { (self as any).postMessage(msg); }

function ensureEngine() {
  if (engine) return;
  try {
    // Load stockfish.js into this worker
    (self as any).importScripts(STOCKFISH_JS_URL);
    const SF = (self as any).Stockfish || (self as any).stockfish || (self as any).Module;
    engine = typeof SF === 'function' ? SF() : (self as any);
    engine.onmessage = (e: MessageEvent<any>) => {
      const text = String(e.data ?? e);
      send({ type: 'info', text });
      const parsed = parseInfo(text);
      if (parsed) send({ type: 'parsedInfo', line: parsed });
      if (/^bestmove\s+(\S+)/.test(text)) {
        const m = text.match(/^bestmove\s+(\S+)/);
        if (m) send({ type: 'bestmove', move: m[1] });
      }
    };
    post('uci');
    post('setoption name UCI_AnalyseMode value true');
    post('setoption name MultiPV value 5');
    post('setoption name UCI_ShowWDL value true');
    post('isready');
    send({ type: 'ready' });
  } catch (err: any) {
    send({ type: 'log', text: 'Failed to load Stockfish: ' + err?.message });
  }
}

function post(cmd: string) { engine?.postMessage(cmd); }

function parseInfo(text: string): ParsedInfo | null {
  if (!/^info /.test(text)) return null;
  const out: ParsedInfo = {};
  const mDepth = text.match(/\bdepth\s(\d+)/);
  if (mDepth) out.depth = Number(mDepth[1]);
  const mNps = text.match(/\bnps\s(\d+)/);
  if (mNps) out.nps = Number(mNps[1]);
  const mScoreMate = text.match(/\bscore\smate\s(-?\d+)/);
  const mScoreCp = text.match(/\bscore\scp\s(-?\d+)/);
  if (mScoreMate) out.mate = Number(mScoreMate[1]);
  if (mScoreCp) out.cp = Number(mScoreCp[1]);
  const mMulti = text.match(/\bmultipv\s(\d+)/);
  if (mMulti) out.multipv = Number(mMulti[1]);
  const mWDL = text.match(/\bwdl\s(\d+)\s(\d+)\s(\d+)/);
  if (mWDL) out.wdl = [Number(mWDL[1]), Number(mWDL[2]), Number(mWDL[3])];
  const mPv = text.match(/\bpv\s(.+)$/);
  if (mPv) out.pv = mPv[1].trim().split(/\s+/);
  return out;
}

self.onmessage = (e: MessageEvent<WorkerFromMain>) => {
  const msg = e.data;
  if (!engine && msg.type !== 'init') ensureEngine();

  switch (msg.type) {
    case 'init':
      ensureEngine();
      break;
    case 'newgame':
      post('ucinewgame');
      break;
    case 'stop':
      post('stop');
      break;
    case 'quit':
      post('quit');
      (self as any).close();
      break;
    case 'position': {
      const pos = msg.fen === 'startpos' ? 'startpos' : `fen ${msg.fen}`;
      const moves = msg.movesUci?.length ? ' moves ' + msg.movesUci.join(' ') : '';
      post(`position ${pos}${moves}`);
      break;
    }
    case 'go': {
      const parts = ['go'];
      if (typeof msg.depth === 'number') parts.push('depth', String(msg.depth));
      if (typeof msg.movetime === 'number') parts.push('movetime', String(msg.movetime));
      if (typeof msg.multipv === 'number') parts.push('multipv', String(msg.multipv));
      post(parts.join(' '));
      break;
    }
    case 'setoption': {
      post(`setoption name ${msg.name} value ${msg.value}`);
      break;
    }
  }
};
