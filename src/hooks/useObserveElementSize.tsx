import useResizeObserver from "@react-hook/resize-observer";
import * as React from "react";

export function useObserveElementSize() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<DOMRectReadOnly | undefined>(undefined);
  useResizeObserver(
    ref,
    React.useCallback((entry) => {
      setSize(entry.contentRect);
    }, []),
  );
  return [ref, size] as const;
}
