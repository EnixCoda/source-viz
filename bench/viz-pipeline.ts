/**
 * Bench: time each phase from "Visualize click" through first render-ready state,
 * using a real exported records.csv.
 *
 * Run: tsx bench/viz-pipeline.ts ~/downloads/records.csv
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import type { DependencyEntry, DependencyMap } from "../src/services/serializers";
import { prepareGraphData, filterGraphData } from "../src/utils/graphData";

function parseRecordsCsv(csv: string): DependencyEntry[] {
  const lines = csv.split("\n");
  lines.shift(); // header
  const map: DependencyMap = new Map();
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const [file, dep, isAsyncStr] = parts;
    const isAsync = isAsyncStr === "true";
    let arr = map.get(file);
    if (!arr) {
      arr = [];
      map.set(file, arr);
    }
    arr.push([dep, isAsync, "local"]);
  }
  return Array.from(map.entries());
}
import { applyDagLayout } from "../src/lib/graph-viz/dag";
import { applyNodeColors, computeEdgeImportance, computeModuleColors } from "../src/lib/graph-viz/renderer";
import {
  forceSimulation,
  forceCollide,
} from "d3-force";

function time<T>(label: string, fn: () => T): T {
  const t0 = performance.now();
  const result = fn();
  const dt = performance.now() - t0;
  console.log(`${label.padEnd(38)} ${dt.toFixed(1).padStart(8)} ms`);
  return result;
}

const csvPath = path.resolve(process.argv[2] || `${process.env.HOME}/downloads/records.csv`);
console.log(`Loading: ${csvPath}`);

const csv = fs.readFileSync(csvPath, "utf8");
console.log(`File size: ${(csv.length / 1024 / 1024).toFixed(2)} MB, ${csv.split("\n").length} lines\n`);

const entries = time("1. parse CSV → entries", () => parseRecordsCsv(csv));
const numFiles = entries.length;
const numDeps = entries.reduce((s, [, d]) => s + d.length, 0);
console.log(`   files: ${numFiles}, dep records: ${numDeps}\n`);

const data = time("2. prepareGraphData", () => prepareGraphData(entries));
console.log(
  `   nodes: ${data.nodes.size}, dependencyMap: ${data.dependencyMap.size}, dependantMap: ${data.dependantMap.size}\n`,
);

const allNodes = [...data.nodes].sort();
const restrictedRoots = new Set(allNodes);
const restrictedLeaves = new Set(allNodes);

// Run filterGraphData 3 times to get stable timing (JIT warmup effect)
time("3a. filterGraphData warmup", () =>
  filterGraphData(data, { roots: new Set(allNodes), leave: new Set(allNodes), graphMode: "dag" }),
);

const graphData = time("3b. filterGraphData (DAG mode, stable)", () =>
  filterGraphData(data, {
    roots: restrictedRoots,
    leave: restrictedLeaves,
    excludes: new Set(),
    graphMode: "dag",
    separateAsyncImports: false,
  }),
);
console.log(
  `   rendered nodes: ${graphData.nodes.length}, links: ${graphData.links.length}, cycles: ${graphData.cycles.length}\n`,
);

const graphDataNatural = time("3c. filterGraphData (natural mode)", () =>
  filterGraphData(data, {
    roots: new Set(allNodes),
    leave: new Set(allNodes),
    excludes: new Set(),
    graphMode: "natural",
    separateAsyncImports: false,
  }),
);
console.log(`   natural rendered links: ${graphDataNatural.links.length}, cycles: ${graphDataNatural.cycles.length}\n`);

const cycleLinks = time("4. cycleLinks set build", () => {
  const set = new Set<string>();
  for (const cycle of graphData.cycles) {
    for (let i = 0; i < cycle.length; i++) {
      set.add(`${cycle[i]}->${cycle[(i + 1) % cycle.length]}`);
    }
  }
  return set;
});
console.log(`   cycle edges: ${cycleLinks.size}\n`);

const renderNodes = graphData.nodes.map((n) => ({ ...n, x: 0, y: 0 } as any));
const nodeMap = new Map(renderNodes.map((n) => [n.id, n]));
const renderLinks = graphData.links
  .map((l) => ({ source: nodeMap.get(l.source)!, target: nodeMap.get(l.target)! }))
  .filter((l) => l.source && l.target);

time("5. computeModuleColors", () => computeModuleColors(renderNodes));
time("6. computeEdgeImportance", () => computeEdgeImportance(renderNodes, renderLinks));
time("6b. applyNodeColors (color-by-module)", () => applyNodeColors(renderNodes, renderLinks, "color-by-module"));
time("7. applyDagLayout (td)", () =>
  applyDagLayout({
    nodes: renderNodes,
    links: renderLinks,
    mode: "td",
    levelDistance: 120,
    width: 1200,
    height: 800,
  }),
);

// Simulate measureText cost (approximated: 4632 calls)
time("7b. measureText simulation (4632 nodes)", () => {
  // estimate: string length * 7px as proxy for ctx.measureText
  let total = 0;
  for (const n of renderNodes) total += (n.id as string).length * 7;
  return total;
});

// Build worker payload cost
time("7c. build worker payload", () => {
  const indexById = new Map<string, number>();
  for (let i = 0; i < renderNodes.length; i++) indexById.set(renderNodes[i].id, i);
  const nodePayload = renderNodes.map((n: any) => ({ x: n.x, y: n.y, radius: 20 }));
  const linkPayload = renderLinks.map((l: any) => ({
    source: indexById.get(l.source.id)!,
    target: indexById.get(l.target.id)!,
  }));
  const dagAxis = new Float32Array(renderNodes.length);
  return { nodePayload, linkPayload, dagAxis };
});

const sim = time("8. forceSimulation init (DAG: collide-only)", () =>
  forceSimulation(renderNodes)
    .force("collide", forceCollide(20).strength(0.5).iterations(2))
    .alphaDecay(0.02)
    .alphaMin(0.05)
    .stop(),
);

let ticks = 0;
time("9. simulation run to settle", () => {
  while (sim.alpha() > sim.alphaMin()) {
    sim.tick();
    ticks++;
  }
});
console.log(`   total ticks: ${ticks}\n`);

console.log("\nDone.");
