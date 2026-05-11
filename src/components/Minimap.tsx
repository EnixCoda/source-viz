import { Box } from "@chakra-ui/react";
import * as React from "react";
import type { GraphViz } from "../lib/graph-viz";

const MINIMAP_W = 160;
const MINIMAP_H = 110;
const PAD = 4;

export function Minimap({
  graphRef,
  refreshKey,
}: {
  graphRef: React.MutableRefObject<GraphViz | null>;
  /** Bump this to force a redraw (e.g., on selection/filter change). */
  refreshKey: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Continuously refresh while the graph might be animating.
  React.useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let lastDraw = 0;

    const draw = (ts: number) => {
      if (cancelled) return;
      // Throttle to ~12 fps — minimap doesn't need full framerate.
      if (ts - lastDraw > 80) {
        lastDraw = ts;
        const canvas = canvasRef.current;
        const graph = graphRef.current;
        if (canvas && graph) {
          renderMinimap(canvas, graph);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [graphRef, refreshKey]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const graph = graphRef.current;
    const canvas = canvasRef.current;
    if (!graph || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const positions = graph.getNodePositions();
    if (!positions.length) return;
    const bounds = computeBounds(positions);
    const scale = Math.min((MINIMAP_W - PAD * 2) / bounds.w, (MINIMAP_H - PAD * 2) / bounds.h);
    // Convert minimap coords back to world coords
    const worldX = bounds.minX + (mx - PAD) / scale;
    const worldY = bounds.minY + (my - PAD) / scale;
    // Recenter (use resetView then re-pan via private API — simplest: use fit-then-pan via zoom transform).
    // We approximate by triggering fit; user-friendly fallback if precise pan is unavailable.
    void worldX;
    void worldY;
    graph.fitToView();
  };

  return (
    <Box
      position="absolute"
      bottom={2}
      right={2}
      zIndex={5}
      bg="whiteAlpha.900"
      backdropFilter="blur(4px)"
      borderRadius="md"
      shadow="sm"
      border="1px solid"
      borderColor="gray.200"
      p={0.5}
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        style={{ width: MINIMAP_W, height: MINIMAP_H, display: "block", cursor: "pointer", borderRadius: 4 }}
        onClick={handleClick}
        title="Click to fit graph to view"
      />
    </Box>
  );
}

function computeBounds(positions: { x: number; y: number }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { x, y } of positions) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return { minX, minY, maxX, maxY, w, h };
}

function renderMinimap(canvas: HTMLCanvasElement, graph: GraphViz) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const positions = graph.getNodePositions();
  ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);
  ctx.fillStyle = "rgba(248, 250, 252, 0.6)";
  ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);
  if (!positions.length) return;
  const b = computeBounds(positions);
  const scale = Math.min((MINIMAP_W - PAD * 2) / b.w, (MINIMAP_H - PAD * 2) / b.h);
  const ox = PAD - b.minX * scale + (MINIMAP_W - PAD * 2 - b.w * scale) / 2;
  const oy = PAD - b.minY * scale + (MINIMAP_H - PAD * 2 - b.h * scale) / 2;

  ctx.fillStyle = "rgba(71, 85, 105, 0.7)";
  for (const p of positions) {
    ctx.fillRect(p.x * scale + ox - 0.5, p.y * scale + oy - 0.5, 1.5, 1.5);
  }

  // Viewport rectangle
  const vp = graph.getViewportRect();
  ctx.strokeStyle = "rgba(37, 99, 235, 0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(vp.x * scale + ox, vp.y * scale + oy, vp.width * scale, vp.height * scale);
}
