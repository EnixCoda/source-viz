import * as React from "react";

export type ScanProgress = [file: string, parsed: boolean, error?: string];

type ScanState = {
  phase: "collecting" | "parsing" | "done";
  progress: ScanProgress[];
  hasError: boolean;
};

type Actions =
  | {
      type: "init";
    }
  | {
      type: "collecting";
      file: string;
    }
  | {
      type: "parsing";
      file: string;
    }
  | {
      type: "done";
    }
  | {
      type: "error";
      file: string;
      error: string;
    };

const initialState: ScanState = { phase: "collecting", progress: [], hasError: false };

const scanningStateReducer = (state: ScanState, action: Actions): ScanState => {
  const { phase, progress, hasError } = state;
  switch (action.type) {
    case "init":
      return initialState;
    case "error":
      return {
        phase,
        progress: progress.map((record) => (record[0] === action.file ? [record[0], record[1], action.error] : record)),
        hasError: true,
      };
    case "collecting":
      return {
        phase: "collecting",
        progress: progress.concat([[action.file, false]]),
        hasError,
      };
    case "parsing":
      return {
        phase: "parsing",
        progress: progress.map((record) => (record[0] === action.file ? [record[0], true, record[2]] : record)),
        hasError,
      };
    case "done":
      return {
        phase: "done",
        progress,
        hasError,
      };
    default:
      return state;
  }
};

export function useScanningStateReducer() {
  return React.useReducer(scanningStateReducer, initialState);
}
