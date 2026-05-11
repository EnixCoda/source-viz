import type { DependencyKind } from "../services/serializers";

export const CLUSTER_PREFIX = "📁 ";

export type GraphNode = { id: string; kind: DependencyKind };
export type GraphLink = { source: string; target: string };
export type ClusterableGraph = { nodes: GraphNode[]; links: GraphLink[] };

export type ClusteredGraph = {
  nodes: GraphNode[];
  links: GraphLink[];
  /** Cluster node id → list of original node ids it represents */
  childrenMap: Map<string, string[]>;
  /** Original node id → cluster id it was rolled up into (or itself if not clustered) */
  parentMap: Map<string, string>;
};

export function isClusterId(id: string): boolean {
  return id.startsWith(CLUSTER_PREFIX);
}

/**
 * Group nodes by their leading path segments (semantic zoom collapse).
 * Nodes with at least `depth + 1` segments are rolled up into a synthetic
 * cluster node named after their first `depth` segments. Shorter paths are
 * left untouched. Edges are aggregated between cluster ids; intra-cluster
 * self-loops are dropped, duplicates de-duped.
 */
export function clusterGraphData(graph: ClusterableGraph, depth = 1): ClusteredGraph {
  const safeDepth = Math.max(1, Math.floor(depth));
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();

  const clusterIdFor = (id: string): string => {
    const parts = id.split("/");
    if (parts.length <= safeDepth) return id;
    return CLUSTER_PREFIX + parts.slice(0, safeDepth).join("/") + "/";
  };

  for (const node of graph.nodes) {
    const cid = clusterIdFor(node.id);
    parentMap.set(node.id, cid);
    if (cid !== node.id) {
      const list = childrenMap.get(cid);
      if (list) list.push(node.id);
      else childrenMap.set(cid, [node.id]);
    }
  }

  const seenNodes = new Set<string>();
  const nodes: GraphNode[] = [];
  for (const node of graph.nodes) {
    const cid = parentMap.get(node.id)!;
    if (seenNodes.has(cid)) continue;
    seenNodes.add(cid);
    if (cid === node.id) {
      nodes.push(node);
    } else {
      nodes.push({ id: cid, kind: "local" });
    }
  }

  const seenLinks = new Set<string>();
  const links: GraphLink[] = [];
  for (const link of graph.links) {
    const s = parentMap.get(link.source) ?? link.source;
    const t = parentMap.get(link.target) ?? link.target;
    if (s === t) continue;
    const key = `${s}\u0001${t}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    links.push({ source: s, target: t });
  }

  return { nodes, links, childrenMap, parentMap };
}
