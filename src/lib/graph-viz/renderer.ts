import { interpolateRgb } from "d3-interpolate";
import { interpolateSinebow } from "d3-scale-chromatic";
import { ColorByMode, EdgeStyleMode, GraphVizOptions, RenderNode, ResolvedLink } from "./types";

// Two-color gradient scales for sequential modes.
// Each pair chosen for maximum perceptual contrast and accessibility.
const DEPTH_COLOR_LOW = "#4fc3f7";   // light sky-blue  (shallow files)
const DEPTH_COLOR_HIGH = "#e65100";  // deep amber-red   (deep files)
const HEAT_COLOR_LOW = "#a5d6a7";    // soft green        (few connections)
const HEAT_COLOR_HIGH = "#b71c1c";   // deep crimson      (many connections)

const depthGradient = interpolateRgb(DEPTH_COLOR_LOW, DEPTH_COLOR_HIGH);
const heatGradient = interpolateRgb(HEAT_COLOR_LOW, HEAT_COLOR_HIGH);

// Okabe-Ito qualitative palette — color-blind safe, 8 distinct hues.
// Ref: https://jfly.uni-koeln.de/color/
const QUALITATIVE_PALETTE = [
  "#0072B2", // blue
  "#E69F00", // orange
  "#009E73", // bluish green
  "#CC79A7", // reddish purple
  "#56B4E9", // sky blue
  "#D55E00", // vermillion
  "#F0E442", // yellow
  "#999999", // neutral gray
];

// FNV-1a string hash → stable bucket index across runs.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function paletteColor(key: string): string {
  return QUALITATIVE_PALETTE[hashString(key) % QUALITATIVE_PALETTE.length];
}

/**
 * Map a key to a position [0,1) on a circular spectrum via stable hash.
 * Two different module strings get well-spread hues; the same string is stable.
 */
function spectrumPosition(key: string): number {
  // Multiply by a fraction of UINT32_MAX so successive bits influence the result.
  return (hashString(key) % 100000) / 100000;
}

const COLORS = {
  selection: "#67e5ab",
  hovered: "#67e5abaa",
  dependant: "#0ccbcb",
  dependency: "#c6f580",
  faded: "rgba(0,0,0,0.1)",
  defaultBg: "rgba(245, 245, 245, 1)",
  fadedBg: "rgba(245, 245, 245, 0.3)",
  defaultBorder: "rgba(200, 200, 200, 0.6)",
  externalBg: "rgba(230, 230, 230, 1)",
  externalBorder: "rgba(180, 180, 180, 0.8)",
  unresolvedBorder: "rgba(230, 120, 40, 0.9)",
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
  // Layered rendering: backgrounds → links → text
  renderNodeBackgrounds(ctx, nodes, globalScale, options, hoverNodeId, levelHoveredNodeIds);
  renderLinks(ctx, links, globalScale, options, hoverNodeId, levelHoveredNodeIds);
  renderNodeLabels(ctx, nodes, globalScale, options, hoverNodeId, levelHoveredNodeIds);
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
): void {
  const arrowLength = options.arrowLength ?? 4;
  const asyncLinks = options.asyncLinks;
  const cycleLinks = options.cycleLinks;
  const edgeStyle: EdgeStyleMode = options.edgeStyle ?? "flat";
  const selectedNodeIds = options.selectedNodeIds;

  // Always gradient between the two endpoint node colors — direction is encoded
  // in the color shift along the edge regardless of color mode.
  const autoGradient = true;

  // LOD: zoom factor drives base visibility — fades out at extreme zoom-out
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

    if (edgeAlpha < 0.03) continue;

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
    const isHighlightedEdge = options.highlightedEdges?.has(`${source.id}->${target.id}`);

    const sourceColor = (source as RenderNode)._color ?? (source as RenderNode)._moduleColor ?? "#888";
    const targetColor = (target as RenderNode)._color ?? (target as RenderNode)._moduleColor ?? "#888";
    const isCrossModule = extractModule(source.id) !== extractModule(target.id);
    const effectiveAlpha = isCrossModule ? edgeAlpha : edgeAlpha * 0.55;

    // Edges always gradient from source→target node color, reinforcing
    // directionality regardless of the active color mode. Neutral gray only
    // when neither endpoint has a color assigned yet.
    const NEUTRAL_EDGE = "#9aa0a6";
    let strokeColor = sourceColor !== "#888" ? sourceColor : NEUTRAL_EDGE;
    let arrowColor = targetColor !== "#888" ? targetColor : NEUTRAL_EDGE;
    let cycleHighlight = false;

    if (edgeStyle === "highlight-cycles" && isCycleEdge) {
      strokeColor = "#ff4444";
      arrowColor = "#ff4444";
      cycleHighlight = true;
    }

    if (isHighlightedEdge) {
      strokeColor = "#ff8800";
      arrowColor = "#ff8800";
      cycleHighlight = true;
      lineWidth = Math.max(lineWidth, 3 / globalScale);
    }

    ctx.globalAlpha = cycleHighlight ? Math.min(1, effectiveAlpha * 2.5) : effectiveAlpha;

    if (isAsync) {
      ctx.setLineDash([5 / globalScale, 5 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }

    if (edgeStyle === "tapered" && !autoGradient) {
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
    } else if (autoGradient || edgeStyle === "gradient") {
      // Gradient: blend source color → target color along the edge.
      // In sequential modes (depth, heat) this is always active to reinforce
      // the scalar encoding direction without a user toggle.
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
}

function renderNodeBackgrounds(
  ctx: CanvasRenderingContext2D,
  nodes: RenderNode[],
  globalScale: number,
  options: GraphVizOptions,
  hoverNodeId: string | null,
  levelHoveredNodeIds: Set<string> | null = null
) {
  const { selectedNodeIds, dependencyMap, dependantMap, highlightedNodeIds } = options;

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;

    const x = node.x;
    const y = node.y;

    const bgWidth = node._width ?? 0;
    const bgHeight = node._height ?? 0;

    const isHighlighted = highlightedNodeIds?.has(node.id) === true;

    // Halo for investigator highlights — draw underneath everything else
    if (isHighlighted) {
      const haloPad = 6 / globalScale;
      ctx.fillStyle = "rgba(255, 196, 0, 0.35)";
      ctx.fillRect(
        x - bgWidth / 2 - haloPad,
        y - bgHeight / 2 - haloPad,
        bgWidth + haloPad * 2,
        bgHeight + haloPad * 2,
      );
    }

    const outline = getOutlineColor(node, selectedNodeIds, hoverNodeId, dependencyMap, dependantMap, levelHoveredNodeIds);
    const borderWidth = 4 / globalScale;

    // Draw outline: solid filled rect for selected; dashed stroke for hovered/connected nodes
    if (outline) {
      if (outline.dashed) {
        ctx.strokeStyle = outline.color;
        ctx.lineWidth = borderWidth;
        ctx.setLineDash([4 / globalScale, 3 / globalScale]);
        ctx.strokeRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = outline.color;
        ctx.fillRect(
          x - bgWidth / 2 - borderWidth,
          y - bgHeight / 2 - borderWidth,
          bgWidth + borderWidth * 2,
          bgHeight + borderWidth * 2
        );
      }
    }

    // Draw background
    const hasFocus = hoverNodeId != null || levelHoveredNodeIds != null || (selectedNodeIds != null && selectedNodeIds.size > 0);
    const isFaded = hasFocus && !outline && !isHighlighted;
    const isExternal = node.kind === "external";
    const isUnresolved = node.kind === "unresolved";
    ctx.fillStyle = isFaded ? COLORS.fadedBg : isExternal ? COLORS.externalBg : COLORS.defaultBg;
    ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);

    // Draw subtle border for unfocused nodes
    if (!outline) {
      if (isUnresolved) {
        ctx.strokeStyle = COLORS.unresolvedBorder;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.setLineDash([3 / globalScale, 2 / globalScale]);
      } else {
        ctx.strokeStyle = isFaded ? "transparent" : isExternal ? COLORS.externalBorder : COLORS.defaultBorder;
        ctx.lineWidth = 1 / globalScale;
      }
      ctx.strokeRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);
      ctx.setLineDash([]);
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
  const { fixFontSize = true, fontSize: preferFontSize = 12, selectedNodeIds, dependencyMap, dependantMap, highlightedNodeIds } = options;
  const fontSize = fixFontSize ? preferFontSize / globalScale : preferFontSize;
  ctx.font = `${fontSize}px Sans-Serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;

    const outline = getOutlineColor(node, selectedNodeIds, hoverNodeId, dependencyMap, dependantMap, levelHoveredNodeIds);
    const hasFocus = hoverNodeId != null || levelHoveredNodeIds != null || (selectedNodeIds != null && selectedNodeIds.size > 0);
    const isHighlighted = highlightedNodeIds?.has(node.id) === true;
    const isFaded = hasFocus && !outline && !isHighlighted;

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

function getOutlineColor(
  node: RenderNode,
  selectedNodeIds: Set<string> | undefined,
  hoverNodeId: string | null,
  dependencyMap?: Map<string, Set<string>>,
  dependantMap?: Map<string, Set<string>>,
  levelHoveredNodeIds?: Set<string> | null
): { color: string; dashed: boolean } | null {
  const nodeId = node.id;
  // Use the node's own color so border always matches text. The outline
  // being drawn signals the relationship; spatial position in the graph
  // already indicates direction (importer vs importee).
  const nodeColor = node._color ?? COLORS.selection;

  if (selectedNodeIds?.has(nodeId)) return { color: nodeColor, dashed: false };

  // Hover takes priority for outline coloring — dashed border signals
  // "focused but not committed"; clicking turns it solid (selected).
  if (hoverNodeId) {
    if (hoverNodeId === nodeId) return { color: nodeColor, dashed: true };
  }

  // Level hover: all nodes on the hovered DAG level — dashed like direct hover
  if (levelHoveredNodeIds && levelHoveredNodeIds.has(nodeId)) return { color: nodeColor, dashed: true };

  // Deps/dependants of hovered node
  if (hoverNodeId) {
    if (dependantMap?.get(hoverNodeId)?.has(nodeId)) return { color: nodeColor, dashed: true };
    if (dependencyMap?.get(hoverNodeId)?.has(nodeId)) return { color: nodeColor, dashed: true };
  }

  // When nodes are selected, always highlight their deps/dependants with a dashed border
  if (selectedNodeIds && selectedNodeIds.size > 0) {
    for (const selectedId of selectedNodeIds) {
      if (dependantMap?.get(selectedId)?.has(nodeId)) return { color: nodeColor, dashed: true };
      if (dependencyMap?.get(selectedId)?.has(nodeId)) return { color: nodeColor, dashed: true };
    }
  }

  return null;
}

/**
 * Assign stable per-file edge colors using a color-blind-safe qualitative palette
 * (Okabe-Ito). Each unique node ID is hashed into one of 8 buckets so adjacent
 * nodes still differ visually but the user sees a small, memorable color set
 * instead of thousands of nearly-identical hues.
 * Mutates node._moduleColor in place.
 */
export function computeModuleColors(nodes: RenderNode[]): void {
  for (const node of nodes) {
    node._moduleColor = paletteColor(node.id);
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
 * Compute node colors based on the colorBy mode.
 * Mutates node._color in place.
 */
export function applyNodeColors(nodes: RenderNode[], links: ResolvedLink[], colorBy: ColorByMode): void {
  switch (colorBy) {
    case "color-by-module": {
      // Locate each module on a perceptually-uniform circular spectrum
      // (sinebow). Files in the same directory share a hue; cousin
      // directories get well-separated hues. Stable across runs via hash.
      const uniqueDirs = new Set(nodes.map((n) => extractModule(n.id)));
      const useFullId = uniqueDirs.size <= 1 && nodes.length > 1;
      for (const node of nodes) {
        const key = useFullId ? node.id : extractModule(node.id);
        node._color = interpolateSinebow(spectrumPosition(key));
      }
      break;
    }
    case "color-by-depth": {
      // Linear ramp between two contrasting colors: sky-blue (shallow) → amber-red (deep).
      const maxDepth = Math.max(1, ...nodes.map((n) => getDepth(n.id)));
      for (const node of nodes) {
        const t = maxDepth === 0 ? 0 : getDepth(node.id) / maxDepth;
        node._color = depthGradient(t);
      }
      break;
    }
    case "color-by-connections":
    case "color-by-imports":
    case "color-by-imported-by": {
      const countMap = new Map<string, number>();
      for (const link of links) {
        if (colorBy !== "color-by-imported-by") {
          countMap.set(link.source.id, (countMap.get(link.source.id) || 0) + 1);
        }
        if (colorBy !== "color-by-imports") {
          countMap.set(link.target.id, (countMap.get(link.target.id) || 0) + 1);
        }
      }
      // log1p compresses the right-skewed distribution so non-hub nodes
      // get distinguishable colors instead of all collapsing near the low end.
      const maxLog = Math.log1p(Math.max(1, ...countMap.values()));
      for (const node of nodes) {
        const count = countMap.get(node.id) || 0;
        const t = maxLog === 0 ? 0 : Math.log1p(count) / maxLog;
        // Linear ramp: soft-green (few connections) → deep-crimson (many connections).
        node._color = heatGradient(t);
      }
      break;
    }
  }
}

function getDepth(id: string): number {
  return (id.match(/\//g) || []).length;
}
