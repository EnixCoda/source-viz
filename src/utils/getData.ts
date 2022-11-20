import { NodeObject } from "force-graph";
import { DependencyEntry } from "../services/serializers";
import { safeMapGet } from "./general";

export function prepareGraphData(data: DependencyEntry[]) {
  const dependencies = new Set<string>(data.flatMap(([, deps]) => deps.map(([dep]) => dep)));
  const nodesArray = data.map(([file]) => file);
  const nodes = new Set(nodesArray);
  const rootFiles = new Set<string>(nodesArray.filter((file) => !dependencies.has(file)));
  const dependencyMap = new Map<string, Set<string>>(); // file -> deps
  const dependantMap = new Map<string, Set<string>>(); // dep -> files
  for (const [file, deps] of data) {
    for (const [dep] of deps) {
      safeMapGet(dependencyMap, file, () => new Set<string>()).add(dep);
      safeMapGet(dependantMap, dep, () => new Set<string>()).add(file);
    }
  }
  return { nodes, dependantMap, dependencyMap, dependencies, rootFiles };
}

export type PreparedData = ReturnType<typeof prepareGraphData>;

type DAGPruneMode = "less leaves" | "less roots";

export const getData = (
  { dependantMap, dependencyMap }: PreparedData,
  {
    roots,
    excludeUp = new Set(),
    excludeDown = new Set(),
    leaves,
    preventCycle,
    dagPruneMode = "less roots",
  }: {
    roots?: Set<string>;
    excludeUp?: Set<string>;
    excludeDown?: Set<string>;
    leaves?: Set<string>;
    preventCycle?: boolean;
    dagPruneMode?: DAGPruneMode;
  } = {}
) => {
  const nodes = new Map<string, NodeObject>();
  const links = new Map<string, Set<string>>();
  const traversedNodes = new Set<NodeObject["id"]>();

  type TraverseDirection = "dependant" | "dependency";

  const traverseData = (id: string, direction: TraverseDirection, preventCycle = true, stack: string[] = []) => {
    if (preventCycle && stack.includes(id)) return;

    if (excludeDown.has(id) || excludeUp.has(id)) return;

    if (traversedNodes.has(id)) return;
    traversedNodes.add(id);

    safeMapGet(nodes, id, () => ({ id }));

    if (direction === "dependency") {
      for (const dependency of dependencyMap.get(id)?.values() || []) {
        if (excludeUp.has(dependency)) continue;
        if (excludeDown.has(dependency)) continue;
        safeMapGet(links, id, () => new Set()).add(dependency);
        traverseData(dependency, direction, preventCycle, [...stack, id]);
      }
    }

    if (direction === "dependant") {
      for (const dependant of dependantMap.get(id)?.values() || []) {
        if (excludeUp.has(dependant)) continue;
        if (excludeDown.has(dependant)) continue;
        safeMapGet(links, dependant, () => new Set()).add(id);
        traverseData(dependant, direction, preventCycle, [...stack, id]);
      }
    }
  };

  const traverse = (startNodes: Set<string>, direction: "dependant" | "dependency") => {
    traversedNodes.clear();
    for (const r of startNodes) traverseData(r, direction, preventCycle);
    return new Set(traversedNodes);
  };

  const [downTraversedNodes, upTraversedNodes] =
    dagPruneMode === "less roots"
      ? [traverse(roots || new Set(), "dependant"), traverse(leaves || new Set(), "dependency")]
      : [traverse(leaves || new Set(), "dependency"), traverse(roots || new Set(), "dependant")].reverse();

  // Prune network if roots and leaves are not same
  // This might not be very accurate
  if (roots && leaves) {
    const outOfRangeNodes = new Set<string>();
    for (const node of nodes.values()) {
      if (!(upTraversedNodes.has(node.id) && downTraversedNodes.has(node.id))) {
        nodes.delete(node.id as string);
        outOfRangeNodes.add(node.id as string);
      }
    }

    for (const [from, tos] of links) {
      if (outOfRangeNodes.has(from)) {
        links.delete(from);
      } else {
        for (const to of tos) {
          if (outOfRangeNodes.has(to)) {
            tos.delete(to);
          }
        }
      }
    }
  }

  // remove cycles
  {
    const traversedNodes = new Set<string>();
    for (const id of nodes.keys()) {
      if (traversedNodes.has(id)) continue;

      const go = (id: string, stack: string[]) => {
        if (traversedNodes.has(id)) return;
        traversedNodes.add(id);

        if (stack.includes(id)) return;
        stack.push(id);

        const targets = links.get(id);
        if (targets) {
          for (const target of targets.values()) {
            if (stack.includes(target)) {
              targets.delete(target); // not link from id to target to remove cycles
              continue;
            } else {
              go(target, stack);
            }
          }
        }
        stack.pop();
      };

      go(id, []);
    }
  }

  return {
    nodes: [...nodes.values()],
    links: [...links.entries()]
      .map(([source, targets]) => [...targets.values()].map((target) => ({ source, target })))
      .flat(),
  };
};
