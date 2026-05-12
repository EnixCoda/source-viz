import type { DependencyKind } from "../../services/serializers";

export type { DependencyKind };

export interface NodeObject {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: unknown;
}

export interface LinkObject {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: NodeObject[];
  links: LinkObject[];
}

export type DagMode = "td" | "bu" | "lr" | "rl" | "radialout" | "radialin";

export type ColorByMode = "color-by-module" | "color-by-depth" | "color-by-connections" | "color-by-imports" | "color-by-imported-by";

export type EdgeStyleMode = "flat" | "tapered" | "gradient" | "highlight-cycles";

export interface GraphVizOptions {
  width: number;
  height: number;

  // DAG layout
  dagMode?: DagMode | null;
  dagLevelDistance?: number;

  // Simulation tuning
  alphaDecay?: number;
  velocityDecay?: number;
  collideRadius?: number;

  // Node rendering
  fontSize?: number;
  fixFontSize?: boolean;
  colorBy?: ColorByMode;
  edgeStyle?: EdgeStyleMode;

  // Link rendering
  arrowLength?: number;
  asyncLinks?: Set<string>; // set of "source->target" keys for dashed rendering
  cycleLinks?: Set<string>; // set of "source->target" keys that form cycles
  /** Edges to highlight prominently (e.g. suggested cuts). Keys: "source->target". */
  highlightedEdges?: Set<string>;

  // Behavior

  // Highlight context (for rendering outlines)
  selectedNodeIds?: Set<string>;
  /** Node ID that the context menu is currently open for — kept highlighted while menu is open */
  contextMenuNodeId?: string | null;
  /** Node IDs to render with a halo + label outline (used by usage investigator). */
  highlightedNodeIds?: Set<string>;
  dependencyMap?: Map<string, Set<string>>;
  dependantMap?: Map<string, Set<string>>;

  // Callbacks
  onNodeClick?: (nodeId: string, event: { metaKey: boolean; ctrlKey: boolean }) => void;
  onNodeHover?: (nodeId: string | null, screenX: number, screenY: number) => void;
  onBackgroundClick?: () => void;
  onLevelClick?: (nodeIds: string[], event: { metaKey: boolean; ctrlKey: boolean }) => void;
  onNodeContextMenu?: (nodeId: string, screenX: number, screenY: number) => void;
  onBackgroundContextMenu?: (screenX: number, screenY: number) => void;
  onZoomChange?: (zoom: number) => void;
}

/** Internal node with computed render properties */
export interface RenderNode extends NodeObject {
  kind?: DependencyKind;
  _color?: string;
  /** Stable color derived from the node's module directory — used for edge rendering */
  _moduleColor?: string;
  _width?: number;
  _height?: number;
}

export interface ResolvedLink {
  source: NodeObject;
  target: NodeObject;
  /** Computed importance score (0–1) based on endpoint connectivity */
  _importance?: number;
}
