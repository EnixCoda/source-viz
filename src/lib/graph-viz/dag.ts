import { DagMode, NodeObject, ResolvedLink } from "./types";

interface DagInput {
  nodes: NodeObject[];
  links: ResolvedLink[];
  mode: DagMode;
  levelDistance: number;
  width: number;
  height: number;
}

/**
 * Compute DAG positions for nodes based on topological ordering.
 * Mutates node.x/y in place.
 */
export function applyDagLayout({ nodes, links, mode, levelDistance, width, height }: DagInput): void {
  const levels = computeLevels(nodes, links, mode);
  if (!levels) return;

  const maxLevel = Math.max(...levels.values(), 0);
  if (maxLevel === 0) return;

  // Group nodes by level
  const levelGroups = new Map<number, NodeObject[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    let group = levelGroups.get(level);
    if (!group) {
      group = [];
      levelGroups.set(level, group);
    }
    group.push(node);
  }

  const isHorizontal = mode === "lr" || mode === "rl";
  const isRadial = mode === "radialout" || mode === "radialin";

  if (isRadial) {
    applyRadialLayout(nodes, levels, maxLevel, levelDistance, width, height, mode === "radialin");
  } else {
    applyLinearLayout(levelGroups, maxLevel, levelDistance, width, height, mode, isHorizontal);
  }
}

function applyLinearLayout(
  levelGroups: Map<number, NodeObject[]>,
  maxLevel: number,
  levelDistance: number,
  width: number,
  height: number,
  mode: DagMode,
  isHorizontal: boolean
) {
  const primarySize = isHorizontal ? width : height;
  const secondarySize = isHorizontal ? height : width;
  const totalLevelSpan = maxLevel * levelDistance;
  const startOffset = (primarySize - totalLevelSpan) / 2;

  for (const [level, group] of levelGroups) {
    const effectiveLevel = mode === "bu" || mode === "rl" ? maxLevel - level : level;
    const primaryPos = startOffset + effectiveLevel * levelDistance;
    const spacing = secondarySize / (group.length + 1);

    for (let i = 0; i < group.length; i++) {
      const node = group[i];
      const secondaryPos = spacing * (i + 1) - secondarySize / 2;
      if (isHorizontal) {
        node.x = primaryPos - width / 2;
        node.y = secondaryPos;
      } else {
        node.x = secondaryPos;
        node.y = primaryPos - height / 2;
      }
    }
  }
}

function applyRadialLayout(
  nodes: NodeObject[],
  levels: Map<string, number>,
  maxLevel: number,
  _levelDistance: number,
  width: number,
  height: number,
  inward: boolean
) {
  const cx = 0;
  const cy = 0;

  // Group by level
  const levelGroups = new Map<number, NodeObject[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    let group = levelGroups.get(level);
    if (!group) {
      group = [];
      levelGroups.set(level, group);
    }
    group.push(node);
  }

  const maxRadius = Math.min(width, height) / 2 - 50;

  for (const [level, group] of levelGroups) {
    const effectiveLevel = inward ? maxLevel - level : level;
    const radius = Math.max(10, (effectiveLevel / maxLevel) * maxRadius);
    const angleStep = (2 * Math.PI) / group.length;

    for (let i = 0; i < group.length; i++) {
      const angle = angleStep * i - Math.PI / 2;
      group[i].x = cx + radius * Math.cos(angle);
      group[i].y = cy + radius * Math.sin(angle);
    }
  }
}

function computeLevels(
  nodes: NodeObject[],
  links: ResolvedLink[],
  _mode: DagMode
): Map<string, number> | null {
  // Build adjacency (source -> targets) and in-degree counts
  const forward = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    forward.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const link of links) {
    const sourceId = link.source.id;
    const targetId = link.target.id;
    const fwd = forward.get(sourceId);
    if (fwd === undefined || !inDegree.has(targetId)) continue;
    fwd.push(targetId);
    inDegree.set(targetId, inDegree.get(targetId)! + 1);
  }

  // Kahn's topological sort + longest-path levelling in one pass.
  // Process nodes in topo order so each node's final level = max(pred levels) + 1.
  const levels = new Map<string, number>();
  // Use index-based queue (no shift()) — shift() is O(n).
  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree.get(node.id) === 0) {
      levels.set(node.id, 0);
      queue.push(node.id);
    }
  }
  if (queue.length === 0) return null; // all nodes in cycles

  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const level = levels.get(id)!;
    for (const target of forward.get(id)!) {
      const next = level + 1;
      const cur = levels.get(target);
      if (cur === undefined || next > cur) levels.set(target, next);
      const remaining = inDegree.get(target)! - 1;
      inDegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  // Assign level 0 to any unvisited nodes (in cycles or unreachable from roots)
  for (const node of nodes) {
    if (!levels.has(node.id)) levels.set(node.id, 0);
  }

  return levels;
}
