import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useApp } from './state/store';
import { computePOM, ema } from './pom/pom';
import type { ParsedInfo, WorkerFromMain } from './engine/uci';
import { EnginePanel } from './components/EnginePanel';
import { RightPanel } from './components/RightPanel';

export default function App() {
  const st = useApp();
  const [chess] = useState(() => new Chess());
  const [worker, setWorker] = useState<Worker | null>(null);
  const prevProbs = useRef<[number,number,number] | null>(null);
  const [uciMoves, setUciMoves] = useState<string[]>([]);

  useEffect(() => {
    const w = new Worker(new URL('./engine/engineWorker.ts', import.meta.url), { type: 'module' });
    setWorker(w);
    const onMsg = (e: MessageEvent<any>) => {
      const m = e.data as any;
      if (m.type === 'parsedInfo') handleParsed(m.line as ParsedInfo);
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'init' } as WorkerFromMain);
    return () => { w.terminate(); };
  }, []);

  function handleParsed(line: ParsedInfo) {
    // Merge into MultiPV array
    const copy = [...st.topk];
    if (!line.multipv) return;
    const idx = copy.findIndex(l => l.multipv === line.multipv);
    const item = {
      multipv: line.multipv!,
      depth: line.depth ?? copy[idx]?.depth,
      nps: line.nps ?? copy[idx]?.nps,
      cp: line.cp ?? copy[idx]?.cp,
      mate: line.mate ?? copy[idx]?.mate,
      pv: line.pv ?? copy[idx]?.pv,
      wdl: line.wdl ?? copy[idx]?.wdl,
    };
    if (idx >= 0) copy[idx] = item; else copy.push(item);
    copy.sort((a,b)=> (a.multipv??99)-(b.multipv??99));
    useApp.getState().set({ topk: copy, engineDepth: item.depth ?? st.engineDepth });

    // Compute POM each throttle tick (UI already limited by engine info rate)
    const best = copy.find(l => l.multipv === 1);
    const out = computePOM({
      evalCp: best?.cp,
      wdlEngine: best?.wdl,
      topk: copy,
      legalCount: chess.moves().length,
      eloWhite: st.whiteElo,
      eloBlack: st.blackElo,
      timeControl: st.timeControl,
      chess,
      sideToMove: chess.turn(),
      lastEvalCp: st.lastEvalCp,
      useBookHeuristics: st.useBookHeuristics,
    });

    // EMA smoothing if depth non-decreasing
    const depth = item.depth ?? 0;
    const lastDepth = st.lastDepth ?? 0;
    let p: [number,number,number] = [out.pW, out.pD, out.pB];
    if (depth >= lastDepth) p = ema(prevProbs.current, p, 0.3);
    prevProbs.current = p;

    useApp.getState().set({ pW: p[0], pD: p[1], pB: p[2], why: out.why.slice(0,4), lastEvalCp: best?.cp, lastDepth: depth });
  }

  function startEngine() {
    if (!worker) return;
    const fen = chess.fen();
    worker.postMessage({ type: 'position', fen, movesUci: uciMoves } as WorkerFromMain);
    worker.postMessage({ type: 'go', depth: 20, multipv: 5 } as WorkerFromMain);
  }

  function stopEngine() { worker?.postMessage({ type: 'stop' } as WorkerFromMain); }

  // start/stop on move changes
  useEffect(() => { if (st.engineOn) startEngine(); else stopEngine(); /* eslint-disable */ }, [chess.fen(), st.engineOn]);

  function onDrop(source: string, target: string, piece: string) {
    const move = chess.move({ from: source, to: target, promotion: 'q' });
    if (!move) return false;
    setUciMoves(prev => [...prev, source+target+(piece[1]==='p' && (target[1]==='8'||target[1]==='1') ? 'q' : '')]);
    useApp.getState().set({ positionFEN: chess.fen(), movesSAN: chess.history(), legalCount: chess.moves().length, topk: [], lastDepth: 0 });
    startEngine();
    return true;
  }

  function newGame() {
    chess.reset(); setUciMoves([]);
    useApp.getState().set({ positionFEN: 'startpos', movesSAN: [], legalCount: chess.moves().length, topk: [], lastDepth: 0 });
    startEngine();
  }

  const controls = (
    <div className="panel">
      <div className="row">
        <button onClick={newGame}>New game</button>
        <label className="label">Engine
          <input type="checkbox" checked={st.engineOn} onChange={e=>st.set({ engineOn: e.target.checked })} style={{ marginLeft: 6 }} />
        </label>
        <label className="label">Time control
          <select value={st.timeControl} onChange={e=>st.set({ timeControl: e.target.value as any })} style={{ marginLeft: 6 }}>
            <option>Bullet</option><option>Blitz</option><option>Rapid</option><option>Classical</option>
          </select>
        </label>
        <label className="label">Use opening heuristics
          <input type="checkbox" checked={st.useBookHeuristics} onChange={e=>st.set({ useBookHeuristics: e.target.checked })} style={{ marginLeft: 6 }} />
        </label>
      </div>
      <div className="row">
        <label className="label">White Elo <input className="num" type="number" value={st.whiteElo} onChange={e=>st.set({ whiteElo: Number(e.target.value) })} style={{ width: 80, marginLeft: 6 }} /></label>
        <label className="label">Black Elo <input className="num" type="number" value={st.blackElo} onChange={e=>st.set({ blackElo: Number(e.target.value) })} style={{ width: 80, marginLeft: 6 }} /></label>
      </div>
      <div className="stack">
        <div><strong>Moves</strong></div>
        <div className="moves">
          {st.movesSAN.map((m,i)=>(<span className="chip" key={i}>{i+1}. {m}</span>))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="app">
      <div className="stack">
        <div className="panel">
          <Chessboard position={chess.fen()} onPieceDrop={onDrop} arePiecesDraggable={true} boardWidth={500} />
        </div>
        <EnginePanel lines={st.topk} />
      </div>
      <RightPanel pW={st.pW} pD={st.pD} pB={st.pB} why={st.why} controls={controls} />
    </div>
  );
}
