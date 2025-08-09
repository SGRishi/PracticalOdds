# Chess POM App

A client-only chess app with Stockfish WASM and a Practical Outcome Model (W/D/L) that uses Elo, winning-move density, sharpness/volatility, convertibility, and (optional) opening draw heuristics.

## Setup
1. **Clone & install**
   ```bash
   npm i
```

2. **Stockfish binaries**

   * Download `stockfish.js` and `stockfish.wasm` (WASM build) and place them in:

     ```
     public/engine/stockfish.js
     public/engine/stockfish.wasm
     ```
   * This repo’s worker loads `public/engine/stockfish.js` via `importScripts`.
3. **Run**

   ```bash
   npm run dev
   ```

If Stockfish fails to load, check your paths and that your WASM build matches the JS loader.

## Notes

* MultiPV=5 and `UCI_ShowWDL` are enabled when supported.
* POM logic lives in `src/pom/pom.ts`; heuristics in `src/pom/heuristics.ts`.
* EMA smoothing applied when depth is non-decreasing.
