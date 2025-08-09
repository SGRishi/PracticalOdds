import React from 'react';

export function WDLBar({ pW, pD, pB }: { pW: number; pD: number; pB: number }) {
  const w = (pW * 100).toFixed(1);
  const d = (pD * 100).toFixed(1);
  const b = (pB * 100).toFixed(1);
  return (
    <div>
      <div className="headline">White {w}% | Draw {d}% | Black {b}%</div>
      <div className="bar" role="progressbar" aria-label="WDL">
        <span className="w" style={{ width: `${w}%` }} title={`White ${w}%`} />
        <span className="d" style={{ width: `${d}%` }} title={`Draw ${d}%`} />
        <span className="b" style={{ width: `${b}%` }} title={`Black ${b}%`} />
      </div>
    </div>
  );
}
