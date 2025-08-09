import React from 'react';
import { WDLBar } from './WDLBar';

export function RightPanel({ pW, pD, pB, why, controls }: { pW: number; pD: number; pB: number; why: string[]; controls: React.ReactNode }) {
  return (
    <div className="right">
      {controls}
      <div className="panel">
        <WDLBar pW={pW} pD={pD} pB={pB} />
        <ul className="why">
          {why.slice(0,3).map((w,i)=> <li key={i}>{w}</li>)}
        </ul>
      </div>
    </div>
  );
}
