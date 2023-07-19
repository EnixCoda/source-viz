import * as React from "react";
import { clamp } from "../utils/general";

export function useClampedSize(
  [width, height]: [number, number],
  sizeLimit: {
    width?: { min?: number; max?: number };
    height?: { min?: number; max?: number };
  } = {},
) {
  return React.useMemo(
    () => [
      clamp(width, sizeLimit.width?.min, sizeLimit.width?.max),
      clamp(height, sizeLimit.height?.min, sizeLimit.height?.max),
    ],
    [width, height, sizeLimit],
  );
}
