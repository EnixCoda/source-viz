import { NodeObject } from "force-graph";
import { DependencyEntry } from "../services/serializers";
import { safeMapGet } from "./general";

type NodeId = string;

export function prepareGraphData(data: DependencyEntry[]) {
  const nodes = new Set<NodeId>(data.flatMap(([file, deps]) => [file, ...deps.map(([dep]) => dep)]));
  const dependencies = new Set<NodeId>(data.flatMap(([, deps]) => deps.map(([dep]) => dep)));
  const dependents = new Set<NodeId>(data.map(([file]) => file).filter((file) => !dependencies.has(file)));
  const dependencyMap = new Map<NodeId, Set<NodeId>>(); // file -> deps
  const dependantMap = new Map<NodeId, Set<NodeId>>(); // dep -> files
  for (const [file, deps] of data) {
    for (const [dep] of deps) {
      safeMapGet(dependencyMap, file, () => new Set<NodeId>()).add(dep);
      safeMapGet(dependantMap, dep, () => new Set<NodeId>()).add(file);
    }
  }
  return { nodes, dependantMap, dependencyMap, dependencies, dependents };
}

export type PreparedData = ReturnType<typeof prepareGraphData>;

type DAGPruneMode = "less leave" | "less roots";

export const getData = (
  { dependantMap, dependencyMap }: PreparedData,
  {
    roots,
    leave,
    excludes = new Set(),
    preventCycle,
    dagPruneMode,
  }: {
    roots?: Set<NodeId>;
    leave?: Set<NodeId>;
    excludes?: Set<NodeId>;
    preventCycle?: boolean;
    dagPruneMode?: DAGPruneMode | null;
  } = {}
) => {
  // Traverse through dependency map and dependent map starting from roots and leave to explore the graph
  const traverse = (startNodes: Set<NodeId>, map: Map<NodeId, Set<NodeId>>) => {
    const traversedNodes = new Set<NodeObject["id"]>();
    const cycles: NodeId[][] = [];
    const traverseData = (node: NodeId, stack: NodeId[] = []) => {
      if (excludes.has(node)) return;

      if (stack.includes(node)) {
        cycles.push(stack.slice(stack.indexOf(node)));
        if (preventCycle) return;
      }

      if (traversedNodes.has(node)) return;
      traversedNodes.add(node);

      for (const next of map.get(node)?.values() || []) {
        if (excludes.has(next)) continue;
        traverseData(next, stack.concat(node));
      }
    };

    for (const r of startNodes) traverseData(r);
    return {
      nodes: traversedNodes,
      cycles,
    };
  };
  const [traversedFromRoots, traversedFromLeave] = [
    roots && traverse(roots, dependantMap),
    leave && traverse(leave, dependencyMap),
  ];

  // Prune if both roots and leave are specified
  // Example usage:
  //   Check out all import statements of 'react'(as leaf) starting from 'src/page/Home.js'(as root)
  // If there is a cycle in a fork branch, exclude it
  const nodes = new Set<NodeId>();
  if (traversedFromRoots && traversedFromLeave) {
    for (const node of traversedFromRoots.nodes) if (traversedFromLeave.nodes.has(node)) nodes.add(node);
  } else {
    for (const node of traversedFromRoots?.nodes || []) nodes.add(node);
    for (const node of traversedFromLeave?.nodes || []) nodes.add(node);
  }

  // remove cycles, either
  // 1. duplicated
  // 2. cycle not accessible from both roots and leave
  const cycles: NodeId[][] = [];
  for (const cycle of traversedFromRoots?.cycles || []) if (cycle.every((node) => nodes.has(node))) cycles.push(cycle);
  for (const cycle of traversedFromLeave?.cycles || []) if (cycle.every((node) => nodes.has(node))) cycles.push(cycle);
  // remove duplicated cycles
  const separator = "|";
  const orderedCycles = cycles.map((cycle) => {
    const headOfCycle = cycle.reduce((earliest, item) => (earliest < item ? earliest : item));
    const indexOfHead = cycle.indexOf(headOfCycle);
    return indexOfHead === 0 ? cycle : cycle.slice(indexOfHead).concat(cycle.slice(0, indexOfHead));
  });
  const deduplicatedCycles = Array.from(new Set(orderedCycles.map((cycle) => cycle.join(separator)))).map((cycle) =>
    cycle.split(separator)
  );

  const links = new Map<NodeId, Set<NodeId>>();
  for (const node of nodes) {
    dependencyMap.get(node)?.forEach((dependency) => {
      if (nodes.has(dependency)) safeMapGet(links, node, () => new Set()).add(dependency);
    });
    dependantMap.get(node)?.forEach((dependant) => {
      if (nodes.has(dependant)) safeMapGet(links, dependant, () => new Set()).add(node);
    });
  }

  if (preventCycle) {
    // Remove links to prevent cycle to enable DAG rendering
    // For example, if there was a cycle of `a -> b -> c -> a`.
    // If `a` is root, and prune for less roots, output would be `a -> b -> c`.
    // If `a` is leave, and prune for less leave, output would be `b -> c -> a`.
    cycles.forEach((cycle) => {
      cycle.forEach((node, index) => {
        if (roots && (dagPruneMode === "less roots" || !dagPruneMode)) {
          if (roots.has(node)) {
            const last = cycle[(index === 0 ? cycle.length : index) - 1];
            safeMapGet(links, last, () => new Set()).delete(node);
          }
        } else if (leave && (dagPruneMode === "less leave" || !dagPruneMode)) {
          if (leave.has(node)) {
            const next = cycle[(index === cycle.length ? 0 : index) + 1];
            safeMapGet(links, node, () => new Set()).delete(next);
          }
        }
      });
    });
  }

  return {
    cycles: deduplicatedCycles,
    nodes: [...nodes.values()].map((id) => ({ id })),
    links: [...links.entries()]
      .map(([source, targets]) => [...targets.values()].map((target) => ({ source, target })))
      .flat(),
  };
};
