/**
 * GraphBackdrop — algorithmic animated network rendered behind the hero.
 * Pure canvas, no dependencies. Cheap: ~40 nodes, sparse edges, slow drift.
 * Pauses when off-screen / tab hidden to save battery.
 */
import * as React from "react";
import { Box } from "@chakra-ui/react";

type Node = { x: number; y: number; vx: number; vy: number; r: number };

const NODE_COUNT = 38;
const MAX_LINK_DIST = 140; // pixels; nodes within this distance get a link drawn
const SPEED = 0.18;

function makeNodes(width: number, height: number): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      r: 1.5 + Math.random() * 2,
    });
  }
  return nodes;
}

export function GraphBackdrop() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;
    let nodes: Node[] = [];
    let raf = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) nodes = makeNodes(width, height);
    };

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible && raf === 0) tick();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);

    const tick = () => {
      raf = 0;
      if (!visible) return;
      // Step physics
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
      // Draw
      ctx.clearRect(0, 0, width, height);
      // Links
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          const max2 = MAX_LINK_DIST * MAX_LINK_DIST;
          if (d2 < max2) {
            const t = 1 - Math.sqrt(d2) / MAX_LINK_DIST;
            ctx.strokeStyle = `rgba(66, 153, 225, ${0.18 * t})`; // blue.400 alpha
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // Nodes
      for (const n of nodes) {
        ctx.fillStyle = "rgba(49, 130, 206, 0.55)"; // blue.500 alpha
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <Box position="absolute" inset={0} pointerEvents="none" overflow="hidden" zIndex={0}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {/* Vignette so the backdrop fades into the page edges */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="radial(transparent 30%, white 80%)"
        pointerEvents="none"
      />
    </Box>
  );
}
