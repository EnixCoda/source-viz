import { NodeObject, RenderNode } from "./types";

/**
 * Find the node under the given canvas coordinates.
 * Uses the pre-computed _width/_height bounding boxes on RenderNodes.
 */
export function hitTestNode(
  nodes: RenderNode[],
  canvasX: number,
  canvasY: number
): RenderNode | null {
  // Iterate in reverse so topmost rendered node is found first
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.x == null || node.y == null) continue;

    const halfW = (node._width ?? 60) / 2;
    const halfH = (node._height ?? 16) / 2;

    if (
      canvasX >= node.x - halfW &&
      canvasX <= node.x + halfW &&
      canvasY >= node.y - halfH &&
      canvasY <= node.y + halfH
    ) {
      return node;
    }
  }
  return null;
}

/**
 * Build an async link key for lookup.
 */
export function asyncLinkKey(source: NodeObject["id"], target: NodeObject["id"]): string {
  return `${source}->${target}`;
}
