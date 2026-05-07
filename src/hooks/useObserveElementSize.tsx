import useResizeObserver from "@react-hook/resize-observer";
import * as React from "react";

export function useObserveElementSize() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<DOMRectReadOnly | undefined>(undefined);
  useResizeObserver(
    ref as React.RefObject<HTMLElement>,
    React.useCallback((entry) => {
      setSize(entry.contentRect);
    }, []),
  );
  return [ref, size] as const;
}
