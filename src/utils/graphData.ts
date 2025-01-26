import { NodeObject } from "force-graph";
import { DependencyEntry } from "../services/serializers";
import { safeMapGet } from "./general";
import { w } from "./w";

export type NodeId = NodeObject["id"];

export type GraphMode = "dag" | "natural" | "cycles-only";

export function prepareGraphData(data: DependencyEntry[]) {
  const nodes = new Set<NodeId>(data.flatMap(([file, deps]) => [file, ...deps.map(([dep]) => dep)]));
  const dependencies = new Set<NodeId>(data.flatMap(([, deps]) => deps.map(([dep]) => dep)));
  const dependents = new Set<NodeId>(data.map(([file]) => file).filter((file) => !dependencies.has(file)));
  const dependencyMap = new Map<NodeId, Set<NodeId>>(); // file -> deps
  const dependantMap = new Map<NodeId, Set<NodeId>>(); // dep -> files
  const syncRefMap = new Map<NodeId, Set<NodeId>>();
  const asyncRefMap = new Map<NodeId, Set<NodeId>>();
  for (const [file, deps] of data) {
    for (const [dep, isAsync] of deps) {
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
  return { nodes, dependantMap, dependencyMap, dependencies, dependents, asyncRefMap };
}

export type PreparedData = ReturnType<typeof prepareGraphData>;

type DAGPruneMode = "less leave" | "less roots";

export const filterGraphData = (
  { dependantMap, dependencyMap, asyncRefMap }: PreparedData,
  {
    roots,
    leave,
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
  const preventCycle = graphMode === "dag";

  // Traverse through dependency map and dependent map starting from roots and leave to explore the graph
  const traverse = (startNodes: Set<NodeId>, togoMap: Map<NodeId, Set<NodeId>>) => {
    const traversedNodes = new Set<NodeId>();
    const cycles: NodeId[][] = []; // TODO: or save edges of cycles?
    const mergedNodesMap = new Map<NodeId, Set<NodeId>>();

    const traverseNode = (node: NodeId, stack: NodeId[] = []) => {
      if (stack.includes(node)) {
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
            // TODO: checking from top would be faster
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

      for (const next of togoMap.get(node)?.values() || []) {
        traverseNode(next, stack.concat(node));
      }
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

  // clean up roots, leave, dependantMap, dependencyMap with exclude
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
  const allCycles: NodeId[][] = getAllCycles();

  // remove duplicated cycles
  const cycles = deduplicateCycles(allCycles);

  const links = getLinks();

  if (preventCycle) {
    // Remove links to prevent cycle to enable DAG rendering
    // For example, if there was such cycle `a -> b -> c`.
    // If `a` is root, and prune for less roots, output would be `a -> b -> c`.
    // If `a` is leave, and prune for less leave, output would be `b -> c -> a`.
    allCycles.forEach((cycle) => {
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

  if (graphMode === "cycles-only") {
    for (const node of nodes) {
      if (cycles.every((cycle) => !cycle.includes(node))) {
        nodes.delete(node);
      }
    }

    // links
    // graphData.links.filter(({ source, target }) => nodes.some((node) => node.id === source) && nodes.some((node) => node.id === target))
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
    nodes: [...nodes.values()].map((id) => ({ id })),
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
      dependantMap.get(node)?.forEach((dependant) => {
        if (nodes.has(dependant)) safeMapGet(links, dependant, () => new Set()).add(node);
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
  const separator = "|";
  const orderedCycles = allCycles.map((cycle) => {
    const headOfCycle = cycle.reduce((earliest, item) => (earliest < item ? earliest : item));
    const indexOfHead = cycle.indexOf(headOfCycle);
    return indexOfHead === 0 ? cycle : cycle.slice(indexOfHead).concat(cycle.slice(0, indexOfHead));
  });
  const cycles = Array.from(new Set(orderedCycles.map((cycle) => cycle.join(separator)))).map((cycle) =>
    cycle.split(separator)
  );
  return cycles;
}
