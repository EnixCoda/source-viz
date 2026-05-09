import * as React from "react";

export type ScanProgress = [file: string, parsed: boolean, error?: string];

type ScanState = {
  /**
   * `scanning` covers the overlapping collect+parse window. Collection and
   * parsing run concurrently (streaming pipeline) so a single phase models
   * reality better than the old `collecting` → `parsing` sequence.
   */
  phase: "preparing" | "scanning" | "finalizing" | "done";
  collectedCount: number;
  parsedCount: number;
  lastCollectedFile?: string;
  errors: ScanProgress[];
  /** True once the directory walk has emitted all files. Parses may still be in flight. */
  collectionComplete: boolean;
  hasError: boolean;
  /** Millisecond timestamp when scanning-started was dispatched. */
  scanStartedAt?: number;
  /** Elapsed duration (ms) from scanning-started to done. Set once on done. */
  scanDurationMs?: number;
  /** Number of files that fell back to the secondary (Babel) parser. */
  fallbackCount: number;
  /** Total resolved dependency edge count, set when scan finishes. */
  dependencyLinks: number;
};

type Actions =
  | { type: "init" }
  | { type: "scanning-started" }
  | { type: "collected"; file: string }
  | { type: "collection-complete" }
  | { type: "parsed"; file: string }
  | { type: "fallback-parsed" }
  | { type: "finalizing" }
  | { type: "done"; dependencyLinks: number }
  | { type: "error"; file: string; error: string };

const initialState: ScanState = {
  phase: "preparing",
  collectedCount: 0,
  parsedCount: 0,
  errors: [],
  collectionComplete: false,
  hasError: false,
  fallbackCount: 0,
  dependencyLinks: 0,
};

const scanningStateReducer = (state: ScanState, action: Actions): ScanState => {
  switch (action.type) {
    case "init":
      return initialState;
    case "scanning-started":
      return { ...state, phase: "scanning", scanStartedAt: Date.now() };
    case "error":
      return {
        ...state,
        errors: state.errors.concat([[action.file, false, action.error]]),
        hasError: true,
      };
    case "collected":
      return {
        ...state,
        collectedCount: state.collectedCount + 1,
        lastCollectedFile: action.file,
      };
    case "collection-complete":
      return { ...state, collectionComplete: true };
    case "parsed":
      return {
        ...state,
        parsedCount: state.parsedCount + 1,
      };
    case "fallback-parsed":
      return { ...state, fallbackCount: state.fallbackCount + 1 };
    case "finalizing":
      return { ...state, phase: "finalizing", collectionComplete: true };
    case "done":
      return {
        ...state,
        phase: "done",
        dependencyLinks: action.dependencyLinks,
        scanDurationMs: state.scanStartedAt != null ? Date.now() - state.scanStartedAt : undefined,
      };
    default:
      return state;
  }
};

export function useScanningStateReducer() {
  return React.useReducer(scanningStateReducer, initialState);
}
