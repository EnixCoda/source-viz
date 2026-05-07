import { ColorByMode, EdgeStyleMode, GraphVizOptions, RenderNode, ResolvedLink } from "./types";

const COLORS = {
  selection: "#67e5ab",
  hovered: "#67e5abaa",
  dependant: "#0ccbcb",
  dependency: "#c6f580",
  faded: "rgba(0,0,0,0.1)",
  defaultBg: "rgba(245, 245, 245, 1)",
  fadedBg: "rgba(245, 245, 245, 0.3)",
  defaultBorder: "rgba(200, 200, 200, 0.6)",
};

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  globalScale: number;
  nodes: RenderNode[];
  links: ResolvedLink[];
  options: GraphVizOptions;
  hoverNodeId: string | null;
  /** Unique DAG level positions (Y for td/bu, X for lr/rl) when in linear DAG mode */
  dagLevelPositions?: number[] | null;
  /** Hovered DAG level axis position — highlights all nodes on that level */
  hoveredDagLevel?: number | null;
}

export function renderFrame({ ctx, globalScale, nodes, links, options, hoverNodeId, dagLevelPositions, hoveredDagLevel }: RenderContext): void {
  // Measure node dimensions first so links/arrows can use accurate sizes
  measureNodes(ctx, nodes, globalScale, options);

  // When a DAG level line is hovered, compute the set of nodes on that level
  const dagMode = options.dagMode;
  const isHorizontalDag = dagMode === "lr" || dagMode === "rl";
  const levelHoveredNodeIds: Set<string> | null =
    hoveredDagLevel != null
      ? new Set(
          nodes
            .filter((n) => {
              const pos = isHorizontalDag ? n.x : n.y;
              return pos != null && Math.abs(pos - hoveredDagLevel) < 1;
            })
            .map((n) => n.id)
        )
      : null;

  // DAG alignment lines go behind everything
  if (dagLevelPositions && dagLevelPositions.length > 0) {
    renderDagAlignmentLines(ctx, nodes, dagLevelPositions, globalScale, options, hoveredDagLevel);
  }
  renderGraphBounds(ctx, nodes, globalScale);
  // Layered rendering: backgrounds → links → text → badges
  renderNodeBackgrounds(ctx, nodes, globalScale, options, hoverNodeId, levelHoveredNodeIds);
  const hiddenEdges = renderLinks(ctx, links, globalScale, options, hoverNodeId, levelHoveredNodeIds);
  renderNodeLabels(ctx, nodes, globalScale, options, hoverNodeId, levelHoveredNodeIds);
  if (hiddenEdges.size > 0) {
    renderHiddenEdgeBadges(ctx, nodes, hiddenEdges, globalScale);
  }
}

/**
 * Compute importance scores for edges based on endpoint connectivity.
 * Higher score = edge connects highly-connected nodes (hub-to-hub).
 * Mutates link._importance in place.
 */
export function computeEdgeImportance(nodes: RenderNode[], links: ResolvedLink[]): void {
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    outDegree.set(node.id, 0);
    inDegree.set(node.id, 0);
  }

  for (const link of links) {
    outDegree.set(link.source.id, (outDegree.get(link.source.id) || 0) + 1);
    inDegree.set(link.target.id, (inDegree.get(link.target.id) || 0) + 1);
  }

  let maxRaw = 0;
  const rawScores: number[] = [];
  for (const link of links) {
    const raw = (outDegree.get(link.source.id) || 0) + (inDegree.get(link.target.id) || 0);
    rawScores.push(raw);
    maxRaw = Math.max(maxRaw, raw);
  }

  for (let i = 0; i < links.length; i++) {
    links[i]._importance = maxRaw > 0 ? rawScores[i] / maxRaw : 1;
  }
}

/** Draw a dashed rectangle around the bounding box of all nodes */
function renderGraphBounds(
  ctx: CanvasRenderingContext2D,
  nodes: RenderNode[],
  globalScale: number
) {
  if (nodes.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const hw = (node._width ?? 0) / 2;
    const hh = (node._height ?? 0) / 2;
    minX = Math.min(minX, node.x - hw);
    minY = Math.min(minY, node.y - hh);
    maxX = Math.max(maxX, node.x + hw);
    maxY = Math.max(maxY, node.y + hh);
  }

  if (!isFinite(minX)) return;

  const padding = 20 / globalScale;
  const x = minX - padding;
  const y = minY - padding;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;

  ctx.save();
  ctx.strokeStyle = "rgba(150, 150, 150, 0.3)";
  ctx.lineWidth = 1.5 / globalScale;
  ctx.setLineDash([8 / globalScale, 6 / globalScale]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.restore();
}

/** Draw subtle alignment lines at each DAG level */
function renderDagAlignmentLines(
  ctx: CanvasRenderingContext2D,
  nodes: RenderNode[],
  levelPositions: number[],
  globalScale: number,
  options: GraphVizOptions,
  hoveredDagLevel?: number | null
) {
  if (nodes.length === 0) return;

  const dagMode = options.dagMode;
  const isHorizontal = dagMode === "lr" || dagMode === "rl";

  // Compute the extent of nodes on the cross-axis to know how long lines should be
  let crossMin = Infinity, crossMax = -Infinity;
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const crossVal = isHorizontal ? node.y : node.x;
    const halfCross = isHorizontal ? (node._height ?? 0) / 2 : (node._width ?? 0) / 2;
    crossMin = Math.min(crossMin, crossVal - halfCross);
    crossMax = Math.max(crossMax, crossVal + halfCross);
  }
  if (!isFinite(crossMin)) return;

  const overflow = 40 / globalScale;
  const lineStart = crossMin - overflow;
  const lineEnd = crossMax + overflow;

  ctx.save();
  for (const pos of levelPositions) {
    const isHovered = hoveredDagLevel != null && Math.abs(pos - hoveredDagLevel) < 1;
    ctx.strokeStyle = isHovered ? "rgba(100, 140, 220, 0.55)" : "rgba(140, 160, 200, 0.15)";
    ctx.lineWidth = (isHovered ? 2 : 1) / globalScale;
    ctx.beginPath();
    if (isHorizontal) {
      ctx.moveTo(pos, lineStart);
      ctx.lineTo(pos, lineEnd);
    } else {
      ctx.moveTo(lineStart, pos);
      ctx.lineTo(lineEnd, pos);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function measureNodes(
  ctx: CanvasRenderingContext2D,
  nodes: RenderNode[],
  globalScale: number,
  options: GraphVizOptions
) {
  const { fixFontSize = true, fontSize: preferFontSize = 12 } = options;
  const fontSize = fixFontSize ? preferFontSize / globalScale : preferFontSize;
  ctx.font = `${fontSize}px Sans-Serif`;

  for (const node of nodes) {
    const textWidth = ctx.measureText(node.id).width;
    const padding = fontSize * 0.4;
    node._width = textWidth + padding * 2;
    node._height = fontSize + padding * 2;
  }
}

function renderLinks(
  ctx: CanvasRenderingContext2D,
  links: ResolvedLink[],
  globalScale: number,
  options: GraphVizOptions,
  hoverNodeId: string | null,
  levelHoveredNodeIds: Set<string> | null = null
): Map<string, number> {
  const arrowLength = options.arrowLength ?? 4;
  const asyncLinks = options.asyncLinks;
  const cycleLinks = options.cycleLinks;
  const edgeStyle: EdgeStyleMode = options.edgeStyle ?? "flat";
  const selectedNodeIds = options.selectedNodeIds;
  const hiddenEdges = new Map<string, number>();

  // LOD: zoom factor drives base visibility — drops to 0 at extreme zoom-out
  // so badges grow progressively as more edges are hidden
  const zoomFactor = Math.max(0, Math.min(1, (globalScale - 0.02) / 1.48));
  const baseAlpha = zoomFactor;

  for (const link of links) {
    const source = link.source;
    const target = link.target;
    if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

    const importance = link._importance ?? 0.5;

    // Determine if this edge connects to a hovered or selected node
    const isHighlighted =
      (hoverNodeId != null && (source.id === hoverNodeId || target.id === hoverNodeId)) ||
      (levelHoveredNodeIds != null && (levelHoveredNodeIds.has(source.id) || levelHoveredNodeIds.has(target.id))) ||
      (selectedNodeIds != null && (selectedNodeIds.has(source.id) || selectedNodeIds.has(target.id)));

    // Whether any node is "focused" (hovered or selected) — used for flashlight dimming
    const hasFocus = hoverNodeId != null || levelHoveredNodeIds != null || (selectedNodeIds != null && selectedNodeIds.size > 0);

    let edgeAlpha: number;
    let lineWidth: number;

    if (isHighlighted) {
      edgeAlpha = 0.9;
      lineWidth = 2.5 / globalScale;
    } else {
      edgeAlpha = baseAlpha * (0.15 + 0.85 * importance);
      lineWidth = (0.6 + importance * 2.0) / globalScale;

      // Fade non-connected edges when any node is focused (flashlight effect)
      if (hasFocus) {
        edgeAlpha *= 0.25;
      }
    }

    if (edgeAlpha < 0.03) {
      hiddenEdges.set(source.id, (hiddenEdges.get(source.id) || 0) + 1);
      hiddenEdges.set(target.id, (hiddenEdges.get(target.id) || 0) + 1);
      continue;
    }

    const sx = source.x;
    const sy = source.y;
    const tx = target.x;
    const ty = target.y;

    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    const ux = dx / len;
    const uy = dy / len;

    const srcW = ((source as RenderNode)._width ?? 0) / 2;
    const srcH = ((source as RenderNode)._height ?? 0) / 2;
    const tgtW = ((target as RenderNode)._width ?? 0) / 2;
    const tgtH = ((target as RenderNode)._height ?? 0) / 2;

    const srcEdge = clipToBoxEdge(ux, uy, srcW, srcH);
    const tgtEdge = clipToBoxEdge(-ux, -uy, tgtW, tgtH);

    const lineStartX = sx + ux * srcEdge;
    const lineStartY = sy + uy * srcEdge;
    const lineEndX = tx - ux * tgtEdge;
    const lineEndY = ty - uy * tgtEdge;

    const isAsync = asyncLinks?.has(`${source.id}->${target.id}`);
    const isCycleEdge = cycleLinks?.has(`${source.id}->${target.id}`);

    const sourceColor = (source as RenderNode)._moduleColor ?? "#888";
    const targetColor = (target as RenderNode)._moduleColor ?? "#888";
    const isCrossModule = extractModule(source.id) !== extractModule(target.id);
    const effectiveAlpha = isCrossModule ? edgeAlpha : edgeAlpha * 0.55;

    // Determine final stroke color and arrowhead color based on edge style
    let strokeColor = sourceColor;
    let arrowColor = sourceColor;
    let cycleHighlight = false;

    if (edgeStyle === "highlight-cycles" && isCycleEdge) {
      strokeColor = "#ff4444";
      arrowColor = "#ff4444";
      cycleHighlight = true;
    }

    ctx.globalAlpha = cycleHighlight ? Math.min(1, effectiveAlpha * 2.5) : effectiveAlpha;

    if (isAsync) {
      ctx.setLineDash([5 / globalScale, 5 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }

    if (edgeStyle === "tapered") {
      // Tapered: draw as a filled trapezoid — wide at source, narrow at target
      const fatW = lineWidth * 2.5;
      const thinW = lineWidth * 0.4;
      const nx = -uy; // normal perpendicular to edge direction
      const ny = ux;
      ctx.beginPath();
      ctx.fillStyle = strokeColor;
      ctx.moveTo(lineStartX + nx * fatW, lineStartY + ny * fatW);
      ctx.lineTo(lineStartX - nx * fatW, lineStartY - ny * fatW);
      ctx.lineTo(lineEndX - nx * thinW, lineEndY - ny * thinW);
      ctx.lineTo(lineEndX + nx * thinW, lineEndY + ny * thinW);
      ctx.closePath();
      ctx.fill();
    } else if (edgeStyle === "gradient") {
      // Gradient: blend source color → target color along the edge
      const grad = ctx.createLinearGradient(lineStartX, lineStartY, lineEndX, lineEndY);
      grad.addColorStop(0, sourceColor);
      grad.addColorStop(1, targetColor);
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineWidth;
      ctx.moveTo(lineStartX, lineStartY);
      ctx.lineTo(lineEndX, lineEndY);
      ctx.stroke();
    } else {
      // flat / highlight-cycles: plain stroke
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = cycleHighlight ? lineWidth * 2 : lineWidth;
      ctx.moveTo(lineStartX, lineStartY);
      ctx.lineTo(lineEndX, lineEndY);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Arrowhead
    if (arrowLength > 0 && edgeStyle !== "tapered") {
      const al = (arrowLength * (0.8 + importance * 1.2)) / globalScale;
      ctx.beginPath();
      ctx.fillStyle = arrowColor;
      ctx.moveTo(lineEndX, lineEndY);
      ctx.lineTo(lineEndX - ux * al + uy * al * 0.5, lineEndY - uy * al - ux * al * 0.5);
      ctx.lineTo(lineEndX - ux * al - uy * al * 0.5, lineEndY - uy * al + ux * al * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  return hiddenEdges;
}

/** Draw small badges on nodes that have edges hidden by LOD filtering */
function renderHiddenEdgeBadges(
  ctx: CanvasRenderingContext2D,
  nodes: RenderNode[],
  hiddenEdges: Map<string, number>,
  globalScale: number
) {
  const badgeFontSize = 9 / globalScale;
  ctx.font = `bold ${badgeFontSize}px Sans-Serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const node of nodes) {
    const count = hiddenEdges.get(node.id);
    if (!count || node.x == null || node.y == null) continue;

    const hw = (node._width ?? 0) / 2;
    const hh = (node._height ?? 0) / 2;
    const text = `+${count}`;
    const textWidth = ctx.measureText(text).width;
    const padX = 3 / globalScale;
    const padY = 2 / globalScale;
    const badgeW = textWidth + padX * 2;
    const badgeH = badgeFontSize + padY * 2;

    // Position at bottom-right corner of node
    const bx = node.x + hw + 2 / globalScale;
    const by = node.y + hh - badgeH / 2;
    const radius = 3 / globalScale;

    // Background pill
    ctx.fillStyle = "rgba(255, 120, 50, 0.85)";
    roundRect(ctx, bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, radius);
    ctx.fill();

    // Text
    ctx.fillStyle = "#fff";
    ctx.fillText(text, bx, by);
  }
}

function renderNodeBackgrounds(
  ctx: CanvasRenderingContext2D,
  nodes: RenderNode[],
  globalScale: number,
  options: GraphVizOptions,
  hoverNodeId: string | null,
  levelHoveredNodeIds: Set<string> | null = null
) {
  const { selectedNodeIds, dependencyMap, dependantMap } = options;

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;

    const x = node.x;
    const y = node.y;

    const bgWidth = node._width ?? 0;
    const bgHeight = node._height ?? 0;

    const outlineColor = getOutlineColor(node.id, selectedNodeIds, hoverNodeId, dependencyMap, dependantMap, levelHoveredNodeIds);
    const borderWidth = 4 / globalScale;

    // Draw outline
    if (outlineColor) {
      ctx.fillStyle = outlineColor;
      ctx.fillRect(
        x - bgWidth / 2 - borderWidth,
        y - bgHeight / 2 - borderWidth,
        bgWidth + borderWidth * 2,
        bgHeight + borderWidth * 2
      );
    }

    // Draw background
    const hasFocus = hoverNodeId != null || levelHoveredNodeIds != null || (selectedNodeIds != null && selectedNodeIds.size > 0);
    const isFaded = hasFocus && !outlineColor;
    ctx.fillStyle = isFaded ? COLORS.fadedBg : COLORS.defaultBg;
    ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);

    // Draw subtle border
    if (!outlineColor) {
      ctx.strokeStyle = isFaded ? "transparent" : COLORS.defaultBorder;
      ctx.lineWidth = 1 / globalScale;
      ctx.strokeRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);
    }
  }
}

function renderNodeLabels(
  ctx: CanvasRenderingContext2D,
  nodes: RenderNode[],
  globalScale: number,
  options: GraphVizOptions,
  hoverNodeId: string | null,
  levelHoveredNodeIds: Set<string> | null = null
) {
  const { fixFontSize = true, fontSize: preferFontSize = 12, selectedNodeIds, dependencyMap, dependantMap } = options;
  const fontSize = fixFontSize ? preferFontSize / globalScale : preferFontSize;
  ctx.font = `${fontSize}px Sans-Serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;

    const outlineColor = getOutlineColor(node.id, selectedNodeIds, hoverNodeId, dependencyMap, dependantMap, levelHoveredNodeIds);
    const hasFocus = hoverNodeId != null || levelHoveredNodeIds != null || (selectedNodeIds != null && selectedNodeIds.size > 0);
    const isFaded = hasFocus && !outlineColor;

    if (isFaded) {
      ctx.fillStyle = COLORS.faded;
    } else if (node._color) {
      ctx.fillStyle = node._color;
    } else {
      ctx.fillStyle = "#333";
    }
    ctx.fillText(node.id, node.x, node.y);
  }
}

/** Find distance along direction (ux,uy) from center to edge of a box (halfW × halfH) */
function clipToBoxEdge(ux: number, uy: number, halfW: number, halfH: number): number {
  if (halfW === 0 || halfH === 0) return 0;
  // Ray-box intersection: find t where ray hits box boundary
  const tX = Math.abs(ux) > 1e-6 ? halfW / Math.abs(ux) : Infinity;
  const tY = Math.abs(uy) > 1e-6 ? halfH / Math.abs(uy) : Infinity;
  return Math.min(tX, tY);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getOutlineColor(
  nodeId: string,
  selectedNodeIds: Set<string> | undefined,
  hoverNodeId: string | null,
  dependencyMap?: Map<string, Set<string>>,
  dependantMap?: Map<string, Set<string>>,
  levelHoveredNodeIds?: Set<string> | null
): string | null {
  if (selectedNodeIds?.has(nodeId)) return COLORS.selection;

  // Hover takes priority for outline coloring
  if (hoverNodeId) {
    if (hoverNodeId === nodeId) return COLORS.hovered;
    if (dependantMap?.get(hoverNodeId)?.has(nodeId)) return COLORS.dependant;
    if (dependencyMap?.get(hoverNodeId)?.has(nodeId)) return COLORS.dependency;
  }

  // Level hover: all nodes on the hovered DAG level get the hover color
  if (levelHoveredNodeIds && levelHoveredNodeIds.has(nodeId)) return COLORS.hovered;

  // When no hover but nodes are selected, highlight deps/dependants of selected nodes
  if (selectedNodeIds && selectedNodeIds.size > 0 && !hoverNodeId && !levelHoveredNodeIds) {
    for (const selectedId of selectedNodeIds) {
      if (dependantMap?.get(selectedId)?.has(nodeId)) return COLORS.dependant;
      if (dependencyMap?.get(selectedId)?.has(nodeId)) return COLORS.dependency;
    }
  }

  return null;
}

/**
 * Assign stable per-file edge colors to nodes.
 * Each unique node ID gets a distinct golden-angle hue so that all edges
 * leaving the same source file share one color. This works correctly for
 * both flat projects (all files in src/) and deeply nested projects.
 * Mutates node._moduleColor in place.
 */
export function computeModuleColors(nodes: RenderNode[]): void {
  const idIndex = new Map<string, number>();

  for (const node of nodes) {
    if (!idIndex.has(node.id)) {
      idIndex.set(node.id, idIndex.size);
    }
    node._moduleColor = moduleIndexToColor(idIndex.get(node.id)!);
  }
}

/**
 * Extract the parent directory of a file path.
 * Used for cross-module edge opacity: edges that cross directory boundaries
 * are shown at full opacity; intra-directory edges are slightly muted.
 *
 * "src/components/Button.tsx"  → "src/components"
 * "src/App.tsx"                → "src"
 * "App.tsx"  (no slash)        → "(root)"
 */
function extractModule(id: string): string {
  const lastSlash = id.lastIndexOf("/");
  return lastSlash === -1 ? "(root)" : id.slice(0, lastSlash);
}

/**
 * Map a module index to a high-contrast hue using golden angle spacing.
 * Produces maximally distinct hues for adjacent indices.
 */
function moduleIndexToColor(index: number): string {
  const hue = (index * 137.508) % 360; // golden angle
  return `hsl(${hue.toFixed(1)}, 75%, 42%)`;
}
/**
 * Compute node colors based on the colorBy mode.
 * Mutates node._color in place.
 */
export function applyNodeColors(nodes: RenderNode[], links: ResolvedLink[], colorBy: ColorByMode): void {
  switch (colorBy) {
    case "color-by-module": {
      // Group nodes by parent directory for visual clustering.
      // Fallback: if all files share the same directory (flat project), use the
      // full node ID so every file still gets a distinct color.
      const uniqueDirs = new Set(nodes.map((n) => extractModule(n.id)));
      const useFullId = uniqueDirs.size <= 1 && nodes.length > 1;
      const moduleIndex = new Map<string, number>();
      for (const node of nodes) {
        const mod = useFullId ? node.id : extractModule(node.id);
        if (!moduleIndex.has(mod)) moduleIndex.set(mod, moduleIndex.size);
        node._color = moduleIndexToColor(moduleIndex.get(mod)!);
      }
      break;
    }
    case "color-by-depth": {
      // Sequential lightness scale by path nesting depth.
      // Shallow files are darker (more prominent), deep leaves are lighter.
      const maxDepth = Math.max(1, ...nodes.map((n) => getDepth(n.id)));
      for (const node of nodes) {
        const depth = getDepth(node.id);
        const t = depth / maxDepth; // 0 = shallow, 1 = deep
        // Hue 220 (cool blue-grey), lightness 30%→55% as depth increases
        const lightness = 30 + t * 25;
        node._color = `hsl(220, 40%, ${lightness.toFixed(1)}%)`;
      }
      break;
    }
    case "color-by-heat-both":
    case "color-by-heat-source":
    case "color-by-heat-target": {
      const countMap = new Map<string, number>();
      for (const link of links) {
        if (colorBy !== "color-by-heat-target") {
          countMap.set(link.source.id, (countMap.get(link.source.id) || 0) + 1);
        }
        if (colorBy !== "color-by-heat-source") {
          countMap.set(link.target.id, (countMap.get(link.target.id) || 0) + 1);
        }
      }
      const maxCount = Math.max(1, ...countMap.values());
      for (const node of nodes) {
        const count = countMap.get(node.id) || 0;
        const t = count / maxCount; // 0 = cold, 1 = hot
        node._color = heatColor(t);
      }
      break;
    }
  }
}

function getDepth(id: string): number {
  return (id.match(/\//g) || []).length;
}

function heatColor(t: number): string {
  // Anchors: cold=220°(blue) mid=55°(yellow) hot=0°(red), saturation stays high
  if (t < 0.5) {
    const u = t * 2;
    const hue = 220 - u * (220 - 55); // 220→55
    const lightness = 40 + u * 5;     // 40→45
    return `hsl(${hue.toFixed(1)}, 75%, ${lightness.toFixed(1)}%)`;
  } else {
    const u = (t - 0.5) * 2;
    const hue = 55 - u * 55;          // 55→0
    const lightness = 45 - u * 10;    // 45→35
    return `hsl(${hue.toFixed(1)}, 80%, ${lightness.toFixed(1)}%)`;
  }
}
