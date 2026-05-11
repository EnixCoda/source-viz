import { Box } from "@chakra-ui/react";
import * as React from "react";

/**
 * Renders text that auto-scrolls (marquee) when it overflows its container.
 * Idle for 1.5s, then scrolls left to reveal the end, holds for 1.5s, then
 * scrolls back. Repeats on a 6-second period.
 */
export function MarqueeText({
  children,
  style,
  className,
  ...boxProps
}: {
  children: string;
  style?: React.CSSProperties;
  className?: string;
  [key: string]: unknown;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = React.useState(0);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const overflow = inner.scrollWidth - container.clientWidth;
    setOffset(Math.max(0, overflow));
  }, [children]);

  return (
    <Box
      ref={containerRef}
      overflow="hidden"
      whiteSpace="nowrap"
      style={{ "--marquee-offset": `-${offset}px`, ...style } as React.CSSProperties}
      className={className}
      sx={{
        "& > span": {
          display: "inline-block",
          animation: offset > 0 ? "text-marquee 6s ease-in-out infinite" : "none",
        },
        "@keyframes text-marquee": {
          "0%, 25%": { transform: "translateX(0)" },
          "55%, 80%": { transform: "translateX(var(--marquee-offset, 0))" },
          "100%": { transform: "translateX(0)" },
        },
      }}
      {...boxProps}
    >
      <span ref={innerRef}>{children}</span>
    </Box>
  );
}
