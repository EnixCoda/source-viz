import { DependencyEntry, DependencyKind } from "../services/serializers";
import { safeMapGet } from "./general";
import { w } from "./w";

export type NodeId = string;

export type GraphMode = "dag" | "natural" | "cycles-only";

export function prepareGraphData(data: DependencyEntry[]) {
  const nodes = new Set<NodeId>(data.flatMap(([file, deps]) => [file, ...deps.map(([dep]) => dep)]));
  const dependencies = new Set<NodeId>(data.flatMap(([, deps]) => deps.map(([dep]) => dep)));
  const dependents = new Set<NodeId>(data.map(([file]) => file).filter((file) => !dependencies.has(file)));
  const dependencyMap = new Map<NodeId, Set<NodeId>>(); // file -> deps
  const dependantMap = new Map<NodeId, Set<NodeId>>(); // dep -> files
  const syncRefMap = new Map<NodeId, Set<NodeId>>();
  const asyncRefMap = new Map<NodeId, Set<NodeId>>();
  // "local" wins if a node appears as local in any entry; otherwise highest-priority kind wins
  const nodeKinds = new Map<NodeId, DependencyKind>();
  const kindPriority: Record<DependencyKind, number> = { local: 0, unresolved: 1, external: 2 };
  const setKind = (id: NodeId, kind: DependencyKind) => {
    const current = nodeKinds.get(id);
    if (current === undefined || kindPriority[kind] < kindPriority[current]) nodeKinds.set(id, kind);
  };
  for (const [file, deps] of data) {
    setKind(file, "local");
    for (const [dep, isAsync, kind] of deps) {
      setKind(dep, kind);
      safeMapGet(dependencyMap, file, () => new Set<NodeId>()).add(dep);
      safeMapGet(dependantMap, dep, () => new Set<NodeId>()).add(file);
      if (!isAsync) {
        safeMapGet(syncRefMap, file, () => new Set<NodeId>()).add(dep);
        asyncRefMap.get(file)?.delete(dep);
      } else if (!syncRefMap.get(file)?.has(dep)) {
        safeMapGet(asyncRefMap, file, () => new Set<NodeId>()).add(dep);
      }
    }
  }
  return { nodes, dependantMap, dependencyMap, dependencies, dependents, asyncRefMap, nodeKinds };
}

export type PreparedData = ReturnType<typeof prepareGraphData>;

type DAGPruneMode = "less leave" | "less roots";

/** Deep-clone a Map<string, Set<string>> so mutations don't affect the source. */
function cloneMapOfSets<K, V>(map: Map<K, Set<V>>): Map<K, Set<V>> {
  const clone = new Map<K, Set<V>>();
  for (const [key, set] of map) clone.set(key, new Set(set));
  return clone;
}

export const filterGraphData = (
  { dependantMap: origDependantMap, dependencyMap: origDependencyMap, asyncRefMap, nodeKinds }: PreparedData,
  {
    roots: origRoots,
    leave: origLeave,
    excludes = new Set(),
    graphMode,
    dagPruneMode,
    separateAsyncImports,
  }: {
    roots?: Set<NodeId>;
    leave?: Set<NodeId>;
    excludes?: Set<NodeId>;
    graphMode?: GraphMode;
    dagPruneMode?: DAGPruneMode | null;
    separateAsyncImports?: boolean;
  } = {}
) => {
  // Clone mutable inputs so we never modify the shared PreparedData or caller Sets
  const dependantMap = cloneMapOfSets(origDependantMap);
  const dependencyMap = cloneMapOfSets(origDependencyMap);
  const roots = origRoots ? new Set(origRoots) : undefined;
  const leave = origLeave ? new Set(origLeave) : undefined;

  const preventCycle = graphMode === "dag";

  // Traverse through dependency map and dependent map starting from roots and leave to explore the graph
  const traverse = (startNodes: Set<NodeId>, togoMap: Map<NodeId, Set<NodeId>>) => {
    const traversedNodes = new Set<NodeId>();
    const cycles: NodeId[][] = [];
    const mergedNodesMap = new Map<NodeId, Set<NodeId>>();

    const stack: NodeId[] = [];
    const stackSet = new Set<NodeId>(); // O(1) membership instead of O(n) stack.includes()

    const traverseNode = (node: NodeId) => {
      if (stackSet.has(node)) {
        // save nodes in stack as a cycle
        const nodesOnCycle = stack.slice(stack.indexOf(node));
        saveCycle(nodesOnCycle);
        if (preventCycle) return;
      }

      if (traversedNodes.has(node)) {
        // see if node is on any existing cycle
        const mergedNodes = mergedNodesMap.get(node);
        if (mergedNodes) {
          for (const item of stack) {
            if (mergedNodes === mergedNodesMap.get(item)) {
              const nodesOnCycle = stack.slice(stack.indexOf(item));
              saveCycle(nodesOnCycle);
              return;
            }
          }
        }
        return;
      }
      traversedNodes.add(node);

      stack.push(node);
      stackSet.add(node);
      for (const next of togoMap.get(node)?.values() || []) {
        traverseNode(next);
      }
      stack.pop();
      stackSet.delete(node);
    };

    function saveCycle(nodesOnCycle: string[]) {
      cycles.push(nodesOnCycle);
      // save nodes on cycle as merged nodes
      const nodesToMerge = new Set(nodesOnCycle);
      const mapsToUpdate = new Set<Set<NodeId>>();
      mapsToUpdate.add(nodesToMerge);

      for (const node of nodesOnCycle) {
        const mergedNodes = mergedNodesMap.get(node);
        if (mergedNodes) {
          mapsToUpdate.add(mergedNodes);
        }
      }
      if (mapsToUpdate.size > 1) {
        const mergedNodes = new Set<NodeId>([...mapsToUpdate].flatMap((set) => [...set]));
        for (const map of mapsToUpdate) {
          for (const node of map) {
            mergedNodesMap.set(node, mergedNodes);
          }
        }
      } else {
        for (const node of nodesOnCycle) {
          mergedNodesMap.set(node, nodesToMerge);
        }
      }
    }

    for (const r of startNodes) traverseNode(r);
    return {
      nodes: traversedNodes,
      cycles,
    };
  };

  // Clean up roots, leave, dependantMap, dependencyMap with exclude.
  // Safe to mutate — we're working on clones.
  if (excludes.size) {
    for (const group of [roots, leave]) {
      if (group) {
        for (const node of group) {
          if (excludes.has(node)) {
            group.delete(node);
          }
        }
      }
    }
    for (const map of [dependantMap, dependencyMap]) {
      for (const [node, items] of map) {
        if (excludes.has(node)) {
          map.delete(node);
        } else {
          for (const item of items) {
            if (excludes.has(item)) {
              items.delete(item);
            }
          }
        }
      }
    }
  }

  const [traversedFromRoots, traversedFromLeave] = [
    roots && traverse(roots, dependantMap),
    leave && traverse(leave, dependencyMap),
  ];

  // Prune if both roots and leave are specified
  const nodes = new Set<NodeId>();
  if (traversedFromRoots && traversedFromLeave) {
    for (const node of traversedFromRoots.nodes) if (traversedFromLeave.nodes.has(node)) nodes.add(node);
  } else {
    for (const node of traversedFromRoots?.nodes || []) nodes.add(node);
    for (const node of traversedFromLeave?.nodes || []) nodes.add(node);
  }

  const allCycles: NodeId[][] = getAllCycles();
  const cycles = deduplicateCycles(allCycles);
  const links = getLinks();

  if (preventCycle) {
    // Remove back-edges to break cycles for DAG rendering.
    allCycles.forEach((cycle) => {
      cycle.forEach((node, index) => {
        if (roots && (dagPruneMode === "less roots" || !dagPruneMode)) {
          if (roots.has(node)) {
            const prev = cycle[(index - 1 + cycle.length) % cycle.length];
            safeMapGet(links, prev, () => new Set()).delete(node);
          }
        } else if (leave && (dagPruneMode === "less leave" || !dagPruneMode)) {
          if (leave.has(node)) {
            const next = cycle[(index + 1) % cycle.length];
            safeMapGet(links, node, () => new Set()).delete(next);
          }
        }
      });
    });
  }

  if (graphMode === "cycles-only") {
    const cycleNodes = new Set<NodeId>(cycles.flat());
    for (const node of nodes) {
      if (!cycleNodes.has(node)) nodes.delete(node);
    }

    for (const [source, targets] of links.entries()) {
      if (nodes.has(source)) {
        for (const target of targets) {
          if (!nodes.has(target)) {
            targets.delete(target);
          }
        }
      } else {
        links.delete(source);
      }
    }
  }

  return {
    cycles,
    suggestedCuts: computeSuggestedCuts(cycles),
    nodes: [...nodes.values()].map((id) => ({ id, kind: nodeKinds.get(id) ?? ("local" as DependencyKind) })),
    links: w(
      [...links.entries()]
        .map(([source, targets]) => [...targets.values()].map((target) => ({ source, target })))
        .flat()
    )((links) =>
      separateAsyncImports ? links.filter(({ source, target }) => !asyncRefMap.get(source)?.has(target)) : links
    ),
  };

  function getLinks() {
    const links = new Map<NodeId, Set<NodeId>>();
    for (const node of nodes) {
      dependencyMap.get(node)?.forEach((dependency) => {
        if (nodes.has(dependency)) safeMapGet(links, node, () => new Set()).add(dependency);
      });
    }
    return links;
  }

  function getAllCycles() {
    const allCycles: NodeId[][] = [];
    for (const cycles of [traversedFromRoots?.cycles, traversedFromLeave?.cycles]) {
      if (cycles) {
        for (const cycle of cycles) {
          if (cycle.every((node) => nodes.has(node))) {
            allCycles.push(cycle);
          }
        }
      }
    }
    return allCycles;
  }
};

function deduplicateCycles(allCycles: string[][]) {
  const orderedCycles = allCycles.map((cycle) => {
    const headOfCycle = cycle.reduce((earliest, item) => (earliest < item ? earliest : item));
    const indexOfHead = cycle.indexOf(headOfCycle);
    return indexOfHead === 0 ? cycle : cycle.slice(indexOfHead).concat(cycle.slice(0, indexOfHead));
  });
  const seen = new Set<string>();
  const cycles: string[][] = [];
  for (const cycle of orderedCycles) {
    const key = JSON.stringify(cycle);
    if (!seen.has(key)) {
      seen.add(key);
      cycles.push(cycle);
    }
  }
  return cycles;
}

export type SuggestedCut = {
  source: NodeId;
  target: NodeId;
  cycleCount: number;
  cycleIndices: number[];
};

/**
 * Rank edges by how many cycles each one belongs to. Cutting top-ranked edges
 * breaks the most cycles per removal. For each cycle, every consecutive pair
 * (including wrap-around) is an edge participating in that cycle.
 */
export function computeSuggestedCuts(cycles: NodeId[][]): SuggestedCut[] {
  const counts = new Map<string, { source: NodeId; target: NodeId; cycleIndices: number[] }>();
  cycles.forEach((cycle, cycleIdx) => {
    if (cycle.length < 2) return;
    for (let i = 0; i < cycle.length; i++) {
      const source = cycle[i];
      const target = cycle[(i + 1) % cycle.length];
      const key = JSON.stringify([source, target]);
      const entry = counts.get(key);
      if (entry) entry.cycleIndices.push(cycleIdx);
      else counts.set(key, { source, target, cycleIndices: [cycleIdx] });
    }
  });
  return [...counts.values()]
    .map((e) => ({ ...e, cycleCount: e.cycleIndices.length }))
    .sort((a, b) => b.cycleCount - a.cycleCount || (a.source + a.target).localeCompare(b.source + b.target));
}

/** Fan-in (number of importers) per node id. */
export function computeFanIn(dependantMap: Map<NodeId, Set<NodeId>>): Map<NodeId, number> {
  const out = new Map<NodeId, number>();
  for (const [id, set] of dependantMap) out.set(id, set.size);
  return out;
}

/** Fan-out (number of imports) per node id. */
export function computeFanOut(dependencyMap: Map<NodeId, Set<NodeId>>): Map<NodeId, number> {
  const out = new Map<NodeId, number>();
  for (const [id, set] of dependencyMap) out.set(id, set.size);
  return out;
}
