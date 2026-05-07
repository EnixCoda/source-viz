import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
} from "d3";
import { select } from "d3";
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3";
import { applyDagLayout } from "./dag";
import { hitTestNode } from "./hit-test";
import { applyNodeColors, computeEdgeImportance, computeModuleColors, renderFrame } from "./renderer";
import { GraphData, GraphVizOptions, RenderNode, ResolvedLink } from "./types";

export class GraphViz {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: GraphVizOptions;

  private simulation: Simulation<RenderNode, SimulationLinkDatum<RenderNode>> | null = null;
  private nodes: RenderNode[] = [];
  private links: ResolvedLink[] = [];
  private transform: ZoomTransform = zoomIdentity;
  private zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown> | null = null;

  private hoverNodeId: string | null = null;
  private draggedNode: RenderNode | null = null;
  private animFrameId: number | null = null;
  private destroyed = false;
  private cleanupListeners: (() => void) | null = null;
  /** Saved DAG-axis positions to constrain after each simulation tick */
  private dagAxisPositions: Map<string, number> | null = null;
  /** Unique sorted level positions for rendering alignment lines */
  private dagLevelPositions: number[] | null = null;
  /** Currently hovered DAG level axis position (null = none) */
  private hoveredDagLevel: number | null = null;

  constructor(container: HTMLElement, options: GraphVizOptions) {
    this.container = container;
    this.options = { ...options };

    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d")!;

    this.setupSize();
    this.setupInteractions();
  }

  /** Update options and re-render. Use for reactive updates. */
  update(options: Partial<GraphVizOptions>): void {
    const sizeChanged =
      (options.width !== undefined && options.width !== this.options.width) ||
      (options.height !== undefined && options.height !== this.options.height);
    const colorByChanged = options.colorBy !== undefined && options.colorBy !== this.options.colorBy;

    Object.assign(this.options, options);

    if (sizeChanged) {
      this.setupSize();
    }

    if (colorByChanged) {
      this.applyColors();
    }

    this.scheduleRender();
  }

  /**
   * Set new graph data.
   * - Preserves positions of nodes that already exist (by id).
   * - Only applies DAG layout on first load. Incremental updates keep existing
   *   positions intact — call rebuildLayout() to recompute the DAG.
   * - Only resets viewport (zoom/pan) on first load.
   */
  setData(data: GraphData): void {
    const isFirstLoad = this.nodes.length === 0;

    // Carry over positions from existing nodes so incremental changes don't scramble the layout
    const prevPositions = new Map<
      string,
      { x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null }
    >();
    for (const node of this.nodes) {
      prevPositions.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy, fx: node.fx, fy: node.fy });
    }

    this.nodes = data.nodes.map((n) => {
      const prev = prevPositions.get(n.id);
      return { ...n, ...prev } as RenderNode;
    });
    this.resolveLinks(data);
    this.applyColors();
    computeModuleColors(this.nodes);
    computeEdgeImportance(this.nodes, this.links);

    if (isFirstLoad && this.options.dagMode) {
      this.applyDagLayoutNow();
    }

    // Only reset viewport on first load; incremental updates keep the user's zoom/pan
    if (isFirstLoad) {
      const centered = zoomIdentity.translate(this.options.width / 2, this.options.height / 2);
      this.transform = centered;
      if (this.zoomBehavior) {
        select(this.canvas).call(this.zoomBehavior.transform, centered);
      }
    }

    this.startSimulation(isFirstLoad);
  }

  /**
   * Recompute layout from scratch (DAG levels, simulation cold-start).
   * Call this when the user wants to refresh the graph after incremental edits.
   */
  rebuildLayout(): void {
    if (this.nodes.length === 0) return;
    // Clear pinned positions so simulation can move nodes freely
    for (const node of this.nodes) {
      node.fx = null;
      node.fy = null;
    }
    if (this.options.dagMode) {
      this.applyDagLayoutNow();
    }
    this.startSimulation(true);
  }

  private applyDagLayoutNow(): void {
    if (!this.options.dagMode) return;
    applyDagLayout({
      nodes: this.nodes,
      links: this.links,
      mode: this.options.dagMode,
      levelDistance: this.options.dagLevelDistance ?? 120,
      width: this.options.width,
      height: this.options.height,
    });
  }

  /** Clean up all resources */
  destroy(): void {
    this.destroyed = true;
    if (this.animFrameId != null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.simulation?.stop();
    this.simulation = null;
    this.cleanupListeners?.();
    this.cleanupListeners = null;
    this.canvas.remove();
  }

  // --- Private ---

  private resolveLinks(data: GraphData): void {
    const nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.links = [];
    for (const link of data.links) {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (source && target) {
        this.links.push({ source, target });
      }
    }
  }

  private applyColors(): void {
    const colorBy = this.options.colorBy ?? "color-by-module";
    applyNodeColors(this.nodes, this.links, colorBy);
  }

  private setupSize(): void {
    const { width, height } = this.options;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private setupInteractions(): void {
    const canvasSelection = select(this.canvas);

    // Track mousedown position for drag-vs-click detection
    let mouseDownX = 0;
    let mouseDownY = 0;

    // Zoom — filter out mousedown events on nodes so zoom doesn't pan during drag
    this.zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.02, 30])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "mousedown") {
          const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
          const node = hitTestNode(this.nodes, cx, cy);
          if (node) return false;
        }
        return true;
      })
      .on("zoom", (event) => {
        this.transform = event.transform;
        this.scheduleRender();
      });

    canvasSelection.call(this.zoomBehavior);

    // Node drag via manual mouse events — left button only
    let dragStarted = false;
    let dragModifiers = { metaKey: false, ctrlKey: false };
    const DRAG_THRESHOLD_PX_SQ = 25; // 5px

    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      mouseDownX = event.offsetX;
      mouseDownY = event.offsetY;
      dragStarted = false;
      dragModifiers = { metaKey: event.metaKey, ctrlKey: event.ctrlKey };

      const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
      const node = hitTestNode(this.nodes, cx, cy);
      if (!node) return;

      this.draggedNode = node;
      node.fx = node.x;
      node.fy = node.y;
      this.simulation?.alphaTarget(0.3).restart();
      this.canvas.style.cursor = "grabbing";
    });

    const onWindowMouseMove = (event: MouseEvent) => {
      if (!this.draggedNode) return;
      const rect = this.canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const [cx, cy] = this.screenToCanvas(screenX, screenY);
      // Don't move the node or fire onNodeDrag until movement exceeds
      // the same threshold the click handler uses to distinguish click from drag.
      // Otherwise micro-drift fires both onNodeDrag AND onNodeClick, causing
      // double-toggle and apparent "click does nothing" behavior.
      if (!dragStarted) {
        const dx = screenX - mouseDownX;
        const dy = screenY - mouseDownY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX_SQ) return;
        dragStarted = true;
        this.options.onNodeDrag?.(this.draggedNode.id, dragModifiers);
      }
      this.draggedNode.fx = cx;
      this.draggedNode.fy = cy;
      this.scheduleRender();
    };

    const onWindowMouseUp = () => {
      if (!this.draggedNode) return;
      this.simulation?.alphaTarget(0);
      if (!this.options.fixNodeOnDragEnd) {
        this.draggedNode.fx = null;
        this.draggedNode.fy = null;
      }
      this.draggedNode = null;
      this.canvas.style.cursor = this.hoverNodeId ? "pointer" : "grab";
    };

    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
    this.cleanupListeners = () => {
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
    };

    // Hover
    this.canvas.addEventListener("mousemove", (event) => {
      if (this.draggedNode) return;
      const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
      const node = hitTestNode(this.nodes, cx, cy);
      const newHoverId = node?.id ?? null;

      // Check alignment line hover only when not hovering a node
      const newLevelHover = newHoverId == null ? this.hitTestDagLevel(cx, cy) : null;

      const changed = newHoverId !== this.hoverNodeId || newLevelHover !== this.hoveredDagLevel;
      if (changed) {
        this.hoverNodeId = newHoverId;
        this.hoveredDagLevel = newLevelHover;
        this.options.onNodeHover?.(newHoverId);
        this.canvas.style.cursor = newHoverId ? "pointer" : "grab";
        this.scheduleRender();
      }
    });

    this.canvas.addEventListener("mouseleave", () => {
      const changed = this.hoverNodeId !== null || this.hoveredDagLevel !== null;
      if (changed && !this.draggedNode) {
        this.hoverNodeId = null;
        this.hoveredDagLevel = null;
        this.options.onNodeHover?.(null);
        this.canvas.style.cursor = "grab";
        this.scheduleRender();
      }
    });

    // Click — genuine click only (< 5px movement from mousedown, and no drag fired)
    this.canvas.addEventListener("click", (event) => {
      const dx = event.offsetX - mouseDownX;
      const dy = event.offsetY - mouseDownY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX_SQ) return; // was a drag, not a click
      if (dragStarted) return; // drag handler already fired the callback

      const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
      const node = hitTestNode(this.nodes, cx, cy);
      if (node) {
        this.options.onNodeClick?.(node.id, { metaKey: event.metaKey, ctrlKey: event.ctrlKey });
      } else {
        this.options.onBackgroundClick?.();
      }
    });

    // Context menu (right-click)
    this.canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
      const node = hitTestNode(this.nodes, cx, cy);
      if (node) {
        this.options.onNodeContextMenu?.(node.id, event.clientX, event.clientY);
      } else {
        this.options.onBackgroundContextMenu?.(event.clientX, event.clientY);
      }
    });

    this.canvas.style.cursor = "grab";
  }

  private screenToCanvas(screenX: number, screenY: number): [number, number] {
    const t = this.transform;
    return [(screenX - t.x) / t.k, (screenY - t.y) / t.k];
  }

  /** Returns the level position if the canvas point (cx, cy) is within 8 screen-pixels of an alignment line */
  private hitTestDagLevel(cx: number, cy: number): number | null {
    if (!this.dagLevelPositions || this.dagLevelPositions.length === 0) return null;
    const { dagMode } = this.options;
    const isHorizontal = dagMode === "lr" || dagMode === "rl";
    // Convert 8 screen pixels to canvas units
    const tolerance = 8 / this.transform.k;
    for (const pos of this.dagLevelPositions) {
      const dist = Math.abs((isHorizontal ? cx : cy) - pos);
      if (dist <= tolerance) return pos;
    }
    return null;
  }

  private startSimulation(coldStart = true): void {
    this.simulation?.stop();

    const { alphaDecay = 0.0228, velocityDecay = 0.4, collideRadius, dagMode } = this.options;
    const isRadial = dagMode === "radialout" || dagMode === "radialin";
    const isHorizontalDag = dagMode === "lr" || dagMode === "rl";
    const isLinearDag = dagMode && !isRadial;

    // Save DAG-axis positions before simulation starts so we can constrain them
    if (isLinearDag) {
      this.dagAxisPositions = new Map();
      for (const node of this.nodes) {
        this.dagAxisPositions.set(node.id, isHorizontalDag ? node.x! : node.y!);
      }
      // Extract unique level positions for alignment lines
      this.dagLevelPositions = [...new Set(this.dagAxisPositions.values())].sort((a, b) => a - b);
    } else {
      this.dagAxisPositions = null;
      this.dagLevelPositions = null;
    }

    this.simulation = forceSimulation<RenderNode>(this.nodes)
      .alpha(coldStart ? 1 : 0.3)
      .force(
        "link",
        forceLink<RenderNode, SimulationLinkDatum<RenderNode>>(
          this.links as unknown as SimulationLinkDatum<RenderNode>[]
        )
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", forceManyBody().strength(dagMode ? -100 : -200))
      .alphaDecay(dagMode ? 0.02 : alphaDecay)
      .velocityDecay(dagMode ? 0.3 : velocityDecay)
      .on("tick", () => {
        this.applyDagConstraints();
        this.scheduleRender();
      });

    // Only add center force in non-DAG mode (DAG layout handles its own centering)
    if (!dagMode) {
      this.simulation.force("center", forceCenter(0, 0));

      // Soft Y-stratification: push nodes to vertical bands by topological depth.
      // This gives a natural top-down flow without locking positions (nodes can
      // still float sideways freely). Strength 0.15 is gentle enough not to fight
      // the link force.
      const depthMap = computeTopoDepth(this.nodes, this.links);
      const maxDepth = Math.max(1, ...depthMap.values());
      const spread = Math.max(200, maxDepth * 120);
      this.simulation.force(
        "y-layer",
        forceY<RenderNode>((n) => ((depthMap.get(n.id) ?? 0) / maxDepth) * spread - spread / 2).strength(0.15)
      );
    }

    if (collideRadius || dagMode) {
      this.simulation.force("collide", forceCollide(collideRadius ?? 30));
    }
  }

  /** Constrain node positions on the DAG axis after each simulation tick */
  private applyDagConstraints(): void {
    if (!this.dagAxisPositions) return;
    const { dagMode } = this.options;
    const isHorizontal = dagMode === "lr" || dagMode === "rl";

    for (const node of this.nodes) {
      const target = this.dagAxisPositions.get(node.id);
      if (target !== undefined) {
        if (isHorizontal) {
          node.x = target;
          node.vx = 0;
        } else {
          node.y = target;
          node.vy = 0;
        }
      }
    }
  }

  private scheduleRender(): void {
    if (this.animFrameId != null || this.destroyed) return;
    this.animFrameId = requestAnimationFrame(() => {
      this.animFrameId = null;
      this.render();
    });
  }

  private render(): void {
    if (this.destroyed) return;

    const { width, height } = this.options;
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Apply zoom transform — centers simulation origin at viewport center
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.k, this.transform.k);

    const globalScale = this.transform.k;

    renderFrame({
      ctx,
      globalScale,
      nodes: this.nodes,
      links: this.links,
      options: this.options,
      hoverNodeId: this.hoverNodeId,
      dagLevelPositions: this.dagLevelPositions,
      hoveredDagLevel: this.hoveredDagLevel,
    });

    ctx.restore();
  }
}

/**
 * Compute topological depth for each node (longest path from any root).
 * Roots (no incoming edges) get depth 0; their dependencies get depth 1, etc.
 * Used to place nodes in vertical bands for natural readability.
 */
function computeTopoDepth(nodes: RenderNode[], links: ResolvedLink[]): Map<string, number> {
  const depth = new Map<string, number>();
  const inEdges = new Map<string, string[]>();

  for (const n of nodes) {
    depth.set(n.id, 0);
    inEdges.set(n.id, []);
  }
  for (const link of links) {
    inEdges.get(link.target.id)?.push(link.source.id);
  }

  // BFS from roots (nodes with no incoming edges)
  const queue: string[] = [];
  for (const n of nodes) {
    if ((inEdges.get(n.id)?.length ?? 0) === 0) {
      queue.push(n.id);
    }
  }

  // Build adjacency list (source → targets)
  const outEdges = new Map<string, string[]>();
  for (const n of nodes) outEdges.set(n.id, []);
  for (const link of links) outEdges.get(link.source.id)?.push(link.target.id);

  let i = 0;
  while (i < queue.length) {
    const id = queue[i++];
    const d = depth.get(id) ?? 0;
    for (const target of outEdges.get(id) ?? []) {
      const cur = depth.get(target) ?? 0;
      if (d + 1 > cur) {
        depth.set(target, d + 1);
        queue.push(target);
      }
    }
  }

  return depth;
}
