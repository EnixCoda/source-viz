import { NodeObject } from "force-graph";
import { DependencyEntry } from "../services/serializers";
import { safeMapGet } from "./general";

interface SNodeObject extends NodeObject {
  id: string;
}

export function prepareGraphData(data: DependencyEntry[]) {
  const nodes = new Set<string>(data.flatMap(([file, deps]) => [file, ...deps.map(([dep]) => dep)]));
  const dependencies = new Set<string>(data.flatMap(([, deps]) => deps.map(([dep]) => dep)));
  const dependents = new Set<string>(data.map(([file]) => file).filter((file) => !dependencies.has(file)));
  const dependencyMap = new Map<string, Set<string>>(); // file -> deps
  const dependantMap = new Map<string, Set<string>>(); // dep -> files
  for (const [file, deps] of data) {
    for (const [dep] of deps) {
      safeMapGet(dependencyMap, file, () => new Set<string>()).add(dep);
      safeMapGet(dependantMap, dep, () => new Set<string>()).add(file);
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
    excludes = new Set(),
    leave,
    preventCycle,
    dagPruneMode = "less roots",
  }: {
    roots?: Set<string>;
    excludes?: Set<string>;
    leave?: Set<string>;
    preventCycle?: boolean;
    dagPruneMode?: DAGPruneMode;
  } = {}
) => {
  const nodes = new Map<string, SNodeObject>();
  const links = new Map<string, Set<string>>();
  const traversedNodes = new Set<SNodeObject["id"]>();

  type TraverseDirection = "dependant" | "dependency";

  const cycles: string[][] = [];

  const traverseData = (id: string, direction: TraverseDirection, stack: string[] = []) => {
    if (stack.includes(id)) {
      cycles.push(stack.slice(stack.indexOf(id)));
      if (preventCycle) return;
    }
    if (excludes.has(id)) return;

    if (traversedNodes.has(id)) return;
    traversedNodes.add(id);

    safeMapGet(nodes, id, () => ({ id }));

    if (direction === "dependency") {
      for (const dependency of dependencyMap.get(id)?.values() || []) {
        if (excludes.has(dependency)) continue;
        safeMapGet(links, id, () => new Set()).add(dependency);
        traverseData(dependency, direction, [...stack, id]);
      }
    }

    if (direction === "dependant") {
      for (const dependant of dependantMap.get(id)?.values() || []) {
        if (excludes.has(dependant)) continue;
        safeMapGet(links, dependant, () => new Set()).add(id);
        traverseData(dependant, direction, [...stack, id]);
      }
    }
  };

  const traverse = (startNodes: Set<string>, direction: "dependant" | "dependency") => {
    traversedNodes.clear();
    for (const r of startNodes) traverseData(r, direction);
    return new Set(traversedNodes);
  };

  const [downTraversedNodes, upTraversedNodes] =
    dagPruneMode === "less roots"
      ? [traverse(roots || new Set(), "dependant"), traverse(leave || new Set(), "dependency")]
      : [traverse(leave || new Set(), "dependency"), traverse(roots || new Set(), "dependant")].reverse();

  // Prune network if roots and leave are not same
  // This might not be very accurate
  if (roots && leave) {
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

  const separator = "|";
  const orderedCycles = cycles.map((cycle) => {
    const first = cycle.indexOf(cycle.reduce((earliest, item) => (earliest < item ? earliest : item)));
    return cycle.slice(first).concat(cycle.slice(0, first));
  });
  const deduplicatedCycles = Array.from(new Set(orderedCycles.map((cycle) => cycle.join(separator)))).map((cycle) =>
    cycle.split(separator)
  );

  return {
    cycles: deduplicatedCycles,
    nodes: [...nodes.values()],
    links: [...links.entries()]
      .map(([source, targets]) => [...targets.values()].map((target) => ({ source, target })))
      .flat(),
  };
};
