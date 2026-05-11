/**
 * Web Worker — runs d3-force simulation off the main thread.
 *
 * Main thread keeps RenderNode object identity; worker only deals with positions
 * via index-based protocol and transferable Float32Arrays for zero-copy.
 *
 * Protocol:
 *   in  { type: "init",   ...config }   // cold-start: new sim
 *   in  { type: "update", ...config }   // in-place: keeps sim alive, swaps nodes/links/forces
 *   in  { type: "restart", alpha }
 *   in  { type: "stop" }
 *   out { type: "tick",  positions: Float32Array }   // [x0,y0,x1,y1,...]
 *   out { type: "end" }
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

interface WorkerNode extends SimulationNodeDatum {
  index: number;
  radius: number;
}

interface SimConfig {
  nodesBuf: Float32Array;   // [x,y,radius, x,y,radius, ...]
  linksBuf: Int32Array;     // [src,tgt, src,tgt, ...]
  dagMode: boolean;
  isHorizontal: boolean;
  dagAxis: Float32Array | null;
  /** 1.0 = hard pin (instant). <1.0 = soft pull (lerp toward target each tick). */
  dagAxisStrength: number;
  depthBands: Float32Array | null;
  spread: number;
  alpha: number;
  alphaDecay: number;
  alphaMin: number;
  velocityDecay: number;
  useCharge: boolean;
  useLink: boolean;
  useCenter: boolean;
  generation: number;
}
type InitMsg = SimConfig & { type: "init" };
type UpdateMsg = SimConfig & { type: "update" };

let sim: Simulation<WorkerNode, SimulationLinkDatum<WorkerNode>> | null = null;
let nodes: WorkerNode[] = [];
let dagAxis: Float32Array | null = null;
let dagAxisStrength = 1;
let isHorizontal = true;
let lastPostMs = 0;
let generation = 0;
const POST_INTERVAL_MS = 33; // ~30Hz position updates to main thread

self.onmessage = (event: MessageEvent<InitMsg | UpdateMsg | { type: "restart"; alpha: number } | { type: "stop" }>) => {
  const msg = event.data;
  if (msg.type === "stop") {
    sim?.stop();
    return;
  }
  if (msg.type === "restart") {
    if (sim) {
      sim.alpha(msg.alpha).restart();
    }
    return;
  }
  if (msg.type === "init") {
    sim?.stop();
    sim = null;
    buildOrUpdateSim(msg, /* cold */ true);
    return;
  }
  if (msg.type === "update") {
    if (!sim) {
      // No sim yet — fall back to cold start
      buildOrUpdateSim(msg, /* cold */ true);
    } else {
      buildOrUpdateSim(msg, /* cold */ false);
    }
    return;
  }
};

function buildOrUpdateSim(cfg: SimConfig, cold: boolean): void {
  // Bump generation so any tick messages already in the main-thread queue
  // (sent under the previous configuration) can be discarded by the receiver.
  generation = cfg.generation;
  // Build node array from buffer
  const newNodes: WorkerNode[] = [];
  for (let i = 0; i < cfg.nodesBuf.length / 3; i++) {
    newNodes.push({
      index: i,
      x: cfg.nodesBuf[i * 3],
      y: cfg.nodesBuf[i * 3 + 1],
      radius: cfg.nodesBuf[i * 3 + 2],
    });
  }
  nodes = newNodes;

  // Build link array referencing the new nodes
  const links: SimulationLinkDatum<WorkerNode>[] = [];
  for (let i = 0; i < cfg.linksBuf.length / 2; i++) {
    const s = cfg.linksBuf[i * 2];
    const t = cfg.linksBuf[i * 2 + 1];
    if (s < nodes.length && t < nodes.length) {
      links.push({ source: nodes[s], target: nodes[t] });
    }
  }

  dagAxis = cfg.dagAxis;
  dagAxisStrength = cfg.dagAxisStrength;
  isHorizontal = cfg.isHorizontal;

  const s = cold || !sim
    ? forceSimulation<WorkerNode>(nodes)
    : sim.nodes(nodes);

  s
    .alpha(cfg.alpha)
    .alphaDecay(cfg.alphaDecay)
    .alphaMin(cfg.alphaMin)
    .velocityDecay(cfg.velocityDecay);

  // Configure forces (always replace so toggling modes works)
  if (cfg.useLink) {
    s.force("link", forceLink<WorkerNode, SimulationLinkDatum<WorkerNode>>(links).distance(80));
  } else {
    s.force("link", null);
  }
  if (cfg.useCharge) {
    s.force("charge", forceManyBody<WorkerNode>().strength(-60));
  } else {
    s.force("charge", null);
  }
  if (cfg.useCenter) {
    s.force("center", forceCenter<WorkerNode>(0, 0));
  } else {
    s.force("center", null);
  }
  if (cfg.depthBands) {
    const bands = cfg.depthBands;
    const spread = cfg.spread;
    s.force(
      "y-layer",
      forceY<WorkerNode>((n) => bands[n.index] * spread - spread / 2).strength(0.15),
    );
  } else {
    s.force("y-layer", null);
  }
  s.force(
    "collide",
    forceCollide<WorkerNode>((n) => n.radius).strength(cfg.dagMode ? 0.15 : 0.5).iterations(2),
  );

  if (cold) {
    s.on("tick", onTick);
    s.on("end", onEnd);
    sim = s;
  } else {
    s.restart();
  }
}

function onTick(): void {
  applyDagConstraints();
  const now = performance.now();
  if (now - lastPostMs >= POST_INTERVAL_MS) {
    lastPostMs = now;
    postPositions();
  }
}

function onEnd(): void {
  postPositions();
  (self as unknown as Worker).postMessage({ type: "end" });
}

function applyDagConstraints(): void {
  if (!dagAxis) return;
  // strength 1 = hard pin (instant); strength <1 lerps toward target each tick
  // for smooth animation when transitioning into DAG mode.
  if (dagAxisStrength >= 1) {
    for (const node of nodes) {
      const target = dagAxis[node.index];
      if (isHorizontal) {
        node.x = target;
        node.vx = 0;
      } else {
        node.y = target;
        node.vy = 0;
      }
    }
  } else {
    const k = dagAxisStrength;
    for (const node of nodes) {
      const target = dagAxis[node.index];
      if (isHorizontal) {
        const x = node.x ?? 0;
        node.x = x + (target - x) * k;
        node.vx = 0;
      } else {
        const y = node.y ?? 0;
        node.y = y + (target - y) * k;
        node.vy = 0;
      }
    }
    // Once close enough to the axis, snap to hard pin so axis lines line up
    // perfectly and we stop wasting work on lerps.
    let maxDelta = 0;
    for (const node of nodes) {
      const target = dagAxis[node.index];
      const cur = isHorizontal ? (node.x ?? 0) : (node.y ?? 0);
      const d = Math.abs(target - cur);
      if (d > maxDelta) maxDelta = d;
    }
    if (maxDelta < 0.5) dagAxisStrength = 1;
  }
}

function postPositions(): void {
  const buf = new Float32Array(nodes.length * 2);
  for (const n of nodes) {
    buf[n.index * 2] = n.x ?? 0;
    buf[n.index * 2 + 1] = n.y ?? 0;
  }
  (self as unknown as Worker).postMessage(
    { type: "tick", positions: buf, generation },
    [buf.buffer]
  );
}
