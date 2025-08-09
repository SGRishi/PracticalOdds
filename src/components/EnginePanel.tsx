import React from 'react';
import type { EngineLine } from '../state/store';

export function EnginePanel({ lines }: { lines: EngineLine[] }) {
  const best = lines.find(l => l.multipv === 1);
  return (
    <div className="panel">
      <div><strong>Engine</strong></div>
      <div className="muted">Depth: {best?.depth ?? '-'} | NPS: {best?.nps ? (best.nps/1000).toFixed(0)+'k' : '-'}</div>
      <div className="list">
        {lines.sort((a,b)=>(a.multipv??99)-(b.multipv??99)).map(l => (
          <div key={l.multipv}>
            <code>#{l.multipv} {l.mate!=null?`M${l.mate}`:`${(l.cp??0)/100} cp`}</code>
            <div style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{l.pv?.slice(0,20).join(' ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
