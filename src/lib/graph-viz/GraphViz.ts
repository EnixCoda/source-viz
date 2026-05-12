import { select } from "d3";
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3";
import { easeCubicOut } from "d3";
import { applyDagLayout } from "./dag";
import { hitTestNode } from "./hit-test";
import { applyNodeColors, computeEdgeImportance, computeModuleColors, renderFrame } from "./renderer";
import { GraphData, GraphVizOptions, RenderNode, ResolvedLink } from "./types";

export class GraphViz {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: GraphVizOptions;

  private simulationWorker: Worker | null = null;
  private nodes: RenderNode[] = [];
  private links: ResolvedLink[] = [];
  private transform: ZoomTransform = zoomIdentity;
  private zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown> | null = null;

  private hoverNodeId: string | null = null;
  private animFrameId: number | null = null;
  private destroyed = false;
  private cleanupListeners: (() => void) | null = null;
  /** Saved DAG-axis positions to constrain after each simulation tick */
  private dagAxisPositions: Map<string, number> | null = null;
  /** Unique sorted level positions for rendering alignment lines */
  private dagLevelPositions: number[] | null = null;
  /** Currently hovered DAG level axis position (null = none) */
  private hoveredDagLevel: number | null = null;
  /** Tracks dagMode at end of last setData() to detect transitions. */
  private lastAppliedDagMode: import("./types").DagMode | null | undefined = null;
  /** Bumped on each init/update postMessage; ticks with stale gen are discarded. */
  private simGeneration = 0;
  /** True while the initial fit-to-view should track the simulation each tick. */
  private autoFitActive = false;

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
    const t0 = performance.now();

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
    console.log(`[GraphViz] resolveLinks: ${(performance.now() - t0).toFixed(1)}ms`);
    this.applyColors();
    computeModuleColors(this.nodes);
    computeEdgeImportance(this.nodes, this.links);
    console.log(`[GraphViz] colors+importance: ${(performance.now() - t0).toFixed(1)}ms`);

    // Seed positions for nodes that didn't exist before, so they don't pop in
    // at (0,0) and shoot across the screen during the in-place update.
    if (!isFirstLoad) {
      this.seedNewNodePositions(prevPositions);
    }

    // Apply DAG layout when:
    //   - first load with dagMode set
    //   - transitioning into DAG mode (or DAG mode/orientation changed)
    // For natural→DAG: setData runs after `update()` set the new dagMode, and
    // after `resolveLinks` rebuilt this.links from the new (DAG-filtered) data,
    // so computeLevels operates on a true DAG.
    const dagMode = this.options.dagMode;
    const dagModeChanged = dagMode !== this.lastAppliedDagMode;
    const needsDagLayout = !!dagMode && (isFirstLoad || dagModeChanged);
    const leavingDag = !!this.lastAppliedDagMode && !dagMode;
    // For incremental DAG transitions (natural→DAG, lr→tb, etc.), animate the
    // move by computing target positions but keeping nodes at current positions.
    // The worker will lerp toward targets. Cold start hard-pins immediately.
    const animateDagTransition = needsDagLayout && !isFirstLoad;

    if (needsDagLayout) {
      if (animateDagTransition) {
        // Snapshot current positions, compute DAG layout (mutates node.x/y),
        // then restore the snapshot. The grid positions will be picked up by
        // startSimulation() into dagAxisPositions and used as soft-pull target.
        const snapshot = new Map<string, { x?: number; y?: number }>();
        for (const node of this.nodes) snapshot.set(node.id, { x: node.x, y: node.y });
        this.applyDagLayoutNow();
        for (const node of this.nodes) {
          const s = snapshot.get(node.id);
          // Stash DAG targets where startSimulation will read them later
          (node as RenderNode & { _dagTargetX?: number; _dagTargetY?: number })._dagTargetX = node.x;
          (node as RenderNode & { _dagTargetX?: number; _dagTargetY?: number })._dagTargetY = node.y;
          if (s) { node.x = s.x; node.y = s.y; }
        }
      } else {
        this.applyDagLayoutNow();
      }
      console.log(`[GraphViz] applyDagLayout (transition): ${(performance.now() - t0).toFixed(1)}ms`);
    } else if (leavingDag) {
      // DAG mode hard-pins node Y via worker constraints. The natural simulation
      // can't overcome the 100-1000px gaps those grid positions create because
      // high friction (velocityDecay=0.6) limits total displacement to ~25px over
      // all ticks. Scatter nodes near the centroid so forces converge properly.
      let cx = 0, cy = 0;
      for (const node of this.nodes) { cx += node.x ?? 0; cy += node.y ?? 0; }
      cx /= Math.max(1, this.nodes.length);
      cy /= Math.max(1, this.nodes.length);
      for (const node of this.nodes) {
        node.fx = null;
        node.fy = null;
        node.x = cx + (Math.random() - 0.5) * 80;
        node.y = cy + (Math.random() - 0.5) * 80;
        node.vx = 0;
        node.vy = 0;
      }
    }
    this.lastAppliedDagMode = dagMode;

    // Only reset viewport on first load; incremental updates keep the user's zoom/pan
    if (isFirstLoad) {
      const centered = zoomIdentity.translate(this.options.width / 2, this.options.height / 2);
      this.transform = centered;
      if (this.zoomBehavior) {
        select(this.canvas).call(this.zoomBehavior.transform, centered);
      }
      this.autoFitActive = true;
    }

    // Layout-changing transitions (entering/leaving DAG) need extra energy
    // so the simulation can spread/settle nodes into their new arrangement.
    const layoutChanged = needsDagLayout || leavingDag;
    this.startSimulation(isFirstLoad, layoutChanged && !isFirstLoad ? 0.6 : undefined);
    console.log(`[GraphViz] startSimulation (worker dispatched): ${(performance.now() - t0).toFixed(1)}ms`);
  }

  /**
   * For nodes new to this update, place them at the centroid of their connected
   * neighbors that already had positions. This avoids the "shoot in from origin"
   * effect when filtering causes nodes to reappear.
   */
  private seedNewNodePositions(
    prevPositions: Map<string, { x?: number; y?: number }>
  ): void {
    const nodeById = new Map<string, RenderNode>();
    for (const node of this.nodes) nodeById.set(node.id, node);

    // Build adjacency from current links
    const neighbors = new Map<string, RenderNode[]>();
    for (const link of this.links) {
      const s = link.source as RenderNode;
      const t = link.target as RenderNode;
      let arr = neighbors.get(s.id);
      if (!arr) { arr = []; neighbors.set(s.id, arr); }
      arr.push(t);
      arr = neighbors.get(t.id);
      if (!arr) { arr = []; neighbors.set(t.id, arr); }
      arr.push(s);
    }

    // Compute centroid of all known positions for fallback
    let cx = 0, cy = 0, cn = 0;
    for (const [, p] of prevPositions) {
      if (p.x != null && p.y != null) { cx += p.x; cy += p.y; cn++; }
    }
    if (cn > 0) { cx /= cn; cy /= cn; }

    for (const node of this.nodes) {
      if (prevPositions.has(node.id)) continue;
      // Average positions of neighbors that have known positions
      const ns = neighbors.get(node.id);
      let sx = 0, sy = 0, n = 0;
      if (ns) {
        for (const nb of ns) {
          if (prevPositions.has(nb.id) && nb.x != null && nb.y != null) {
            sx += nb.x; sy += nb.y; n++;
          }
        }
      }
      if (n > 0) {
        // Add small jitter so collide force can resolve overlap
        node.x = sx / n + (Math.random() - 0.5) * 20;
        node.y = sy / n + (Math.random() - 0.5) * 20;
      } else {
        node.x = cx + (Math.random() - 0.5) * 20;
        node.y = cy + (Math.random() - 0.5) * 20;
      }
    }
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
    this.stopSimulation();
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

    // Zoom — pan/zoom on background; skip mousedown on a node so it bubbles
    // through to the click handler (otherwise d3-zoom calls stopPropagation
    // and mouseDownX/Y never update, causing clicks to miss the threshold check).
    this.zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.02, 30])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "mousedown" && event.button === 0) {
          const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
          if (hitTestNode(this.nodes, cx, cy)) return false;
        }
        return true;
      })
      .on("zoom", (event) => {
        // Any user-initiated pan/zoom cancels the initial auto-fit tracking.
        if (event.sourceEvent) this.autoFitActive = false;
        this.transform = event.transform;
        this.options.onZoomChange?.(event.transform.k);
        this.scheduleRender();
      });

    canvasSelection.call(this.zoomBehavior);

    // Track mousedown position for click detection
    let mouseDownX = 0;
    let mouseDownY = 0;
    let mouseDownOnNode = false;
    let mouseDownOnLevel = false;
    const CLICK_THRESHOLD_PX_SQ = 25; // 5px

    // Use capture so this fires before d3-zoom's mousedown handler, which calls
    // stopImmediatePropagation() and would prevent this from running otherwise.
    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      mouseDownX = event.offsetX;
      mouseDownY = event.offsetY;
      const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
      mouseDownOnNode = !!hitTestNode(this.nodes, cx, cy);
      mouseDownOnLevel = !mouseDownOnNode && this.hitTestDagLevel(cx, cy) != null;
    }, { capture: true });

    // Background dismiss on mouseup — d3-zoom registers a window-level capture
    // mouseup listener on mousedown and calls stopImmediatePropagation(), which
    // prevents our canvas mouseup from firing. By registering at the window
    // capture phase ourselves (before d3-zoom's dynamic listener is added), we
    // guarantee our handler runs first.
    const windowMouseUpHandler = (event: MouseEvent) => {
      if (event.button !== 0 || event.target !== this.canvas || mouseDownOnNode || mouseDownOnLevel) return;
      const dx = event.offsetX - mouseDownX;
      const dy = event.offsetY - mouseDownY;
      if (dx * dx + dy * dy < CLICK_THRESHOLD_PX_SQ) {
        this.options.onBackgroundClick?.();
      }
    };
    window.addEventListener("mouseup", windowMouseUpHandler, { capture: true });
    this.cleanupListeners = () => {
      window.removeEventListener("mouseup", windowMouseUpHandler, { capture: true });
    };

    // Hover
    this.canvas.addEventListener("mousemove", (event) => {
      const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
      const node = hitTestNode(this.nodes, cx, cy);
      const newHoverId = node?.id ?? null;

      // Check alignment line hover only when not hovering a node
      const newLevelHover = newHoverId == null ? this.hitTestDagLevel(cx, cy) : null;

      const changed = newHoverId !== this.hoverNodeId || newLevelHover !== this.hoveredDagLevel;
      if (changed) {
        this.hoverNodeId = newHoverId;
        this.hoveredDagLevel = newLevelHover;
        this.options.onNodeHover?.(newHoverId, event.clientX, event.clientY);
        this.canvas.style.cursor = newHoverId || newLevelHover != null ? "pointer" : "grab";
        this.scheduleRender();
      }
    });

    this.canvas.addEventListener("mouseleave", () => {
      const changed = this.hoverNodeId !== null || this.hoveredDagLevel !== null;
      if (changed) {
        this.hoverNodeId = null;
        this.hoveredDagLevel = null;
        this.options.onNodeHover?.(null, 0, 0);
        this.canvas.style.cursor = "grab";
        this.scheduleRender();
      }
    });

    // Click — node clicks and level clicks (background is handled in mouseup above)
    this.canvas.addEventListener("click", (event) => {
      const dx = event.offsetX - mouseDownX;
      const dy = event.offsetY - mouseDownY;
      if (dx * dx + dy * dy >= CLICK_THRESHOLD_PX_SQ) return;

      const [cx, cy] = this.screenToCanvas(event.offsetX, event.offsetY);
      const node = hitTestNode(this.nodes, cx, cy);
      if (node) {
        this.options.onNodeClick?.(node.id, { metaKey: event.metaKey, ctrlKey: event.ctrlKey });
        return;
      }

      // Check if clicking on a DAG alignment line
      const levelPos = this.hitTestDagLevel(cx, cy);
      if (levelPos != null) {
        const isHorizontal = this.options.dagMode === "lr" || this.options.dagMode === "rl";
        const nodeIds = this.nodes
          .filter((n) => {
            const pos = isHorizontal ? n.x : n.y;
            return pos != null && Math.abs(pos - levelPos) < 1;
          })
          .map((n) => n.id);
        if (nodeIds.length > 0) {
          this.options.onLevelClick?.(nodeIds, { metaKey: event.metaKey, ctrlKey: event.ctrlKey });
        }
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

  private startSimulation(coldStart = true, alphaOverride?: number): void {
    // Decide whether to do an in-place update vs full restart.
    // In-place keeps the worker alive and preserves simulation momentum,
    // making graphMode/edge-set transitions feel smooth.
    const canReuse = !coldStart && this.simulationWorker != null;
    if (!canReuse) {
      this.stopSimulation();
    }

    const t0 = performance.now();
    const { collideRadius, dagMode } = this.options;
    const isRadial = dagMode === "radialout" || dagMode === "radialin";
    const isHorizontalDag = dagMode === "lr" || dagMode === "rl";
    const isLinearDag = dagMode && !isRadial;

    // Pre-measure node label dimensions so collision force can use accurate radii.
    // This mirrors measureNodes() in renderer.ts but runs before the first render tick.
    const { fixFontSize = true, fontSize: preferFontSize = 12 } = this.options;
    const initialScale = this.transform.k || 1;
    const fontSize = fixFontSize ? preferFontSize / initialScale : preferFontSize;
    this.ctx.save();
    this.ctx.font = `${fontSize}px Sans-Serif`;
    const padding = fontSize * 0.4;
    for (const node of this.nodes) {
      if (!node._width || !node._height) {
        const textWidth = this.ctx.measureText(node.id).width;
        node._width = textWidth + padding * 2;
        node._height = fontSize + padding * 2;
      }
    }
    this.ctx.restore();
    console.log(`[sim] measureText ×${this.nodes.length}: ${(performance.now() - t0).toFixed(1)}ms`);

    // Save DAG-axis positions so we can render alignment lines (constraint itself runs in worker).
    // If setData stashed `_dagTarget*` (animated transition), prefer those targets so
    // the worker can lerp current node positions toward them. Otherwise read from node.x/y
    // (cold start path — node.x/y is already at the grid).
    let animatedDagTransition = false;
    if (isLinearDag) {
      this.dagAxisPositions = new Map();
      for (const node of this.nodes) {
        const stash = node as RenderNode & { _dagTargetX?: number; _dagTargetY?: number };
        const target = isHorizontalDag
          ? (stash._dagTargetX ?? node.x ?? 0)
          : (stash._dagTargetY ?? node.y ?? 0);
        if (stash._dagTargetX !== undefined || stash._dagTargetY !== undefined) {
          animatedDagTransition = true;
        }
        this.dagAxisPositions.set(node.id, target);
        // Clear stash so future ticks don't re-trigger animation
        stash._dagTargetX = undefined;
        stash._dagTargetY = undefined;
      }
      this.dagLevelPositions = [...new Set(this.dagAxisPositions.values())].sort((a, b) => a - b);
    } else {
      this.dagAxisPositions = null;
      this.dagLevelPositions = null;
    }

    if (this.nodes.length === 0) return;

    // Pack node positions + radii into a Float32Array [x0,y0,r0, x1,y1,r1, ...]
    // and link indices into an Int32Array [s0,t0, s1,t1, ...].
    // Using TypedArrays lets us transfer (not clone) large link arrays to the worker.
    const indexById = new Map<string, number>();
    for (let i = 0; i < this.nodes.length; i++) indexById.set(this.nodes[i].id, i);

    const nodesBuf = new Float32Array(this.nodes.length * 3);
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const w = n._width ?? 60;
      const h = n._height ?? 20;
      const radius =
        collideRadius != null
          ? typeof collideRadius === "number"
            ? collideRadius
            : (collideRadius as (node: RenderNode) => number)(n)
          : Math.sqrt((w / 2) ** 2 + (h / 2) ** 2) + 4;
      nodesBuf[i * 3] = n.x ?? 0;
      nodesBuf[i * 3 + 1] = n.y ?? 0;
      nodesBuf[i * 3 + 2] = radius;
    }

    // Count valid links first for exact allocation
    let validLinkCount = 0;
    for (const link of this.links) {
      if (indexById.has(link.source.id) && indexById.has(link.target.id)) validLinkCount++;
    }
    const linksBuf = new Int32Array(validLinkCount * 2);
    let li = 0;
    for (const link of this.links) {
      const s = indexById.get(link.source.id);
      const t = indexById.get(link.target.id);
      if (s !== undefined && t !== undefined) {
        linksBuf[li++] = s;
        linksBuf[li++] = t;
      }
    }

    console.log(`[sim] payload build: ${(performance.now() - t0).toFixed(1)}ms (${this.nodes.length} nodes, ${validLinkCount} links)`);

    let dagAxis: Float32Array | null = null;
    if (isLinearDag && this.dagAxisPositions) {
      dagAxis = new Float32Array(this.nodes.length);
      for (let i = 0; i < this.nodes.length; i++) {
        dagAxis[i] = this.dagAxisPositions.get(this.nodes[i].id) ?? 0;
      }
    }

    let depthBands: Float32Array | null = null;
    let spread = 0;
    if (!dagMode) {
      const depthMap = computeTopoDepth(this.nodes, this.links);
      let maxDepth = 1;
      for (const d of depthMap.values()) if (d > maxDepth) maxDepth = d;
      spread = Math.max(200, maxDepth * 120);
      depthBands = new Float32Array(this.nodes.length);
      for (let i = 0; i < this.nodes.length; i++) {
        depthBands[i] = (depthMap.get(this.nodes[i].id) ?? 0) / maxDepth;
      }
    }

    let worker = this.simulationWorker;
    if (!worker) {
      worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
      this.simulationWorker = worker;

      worker.onerror = (e) => {
        console.error("[sim] worker error:", e.message, e);
      };

      worker.onmessage = (event: MessageEvent<{ type: "tick"; positions: Float32Array; generation: number } | { type: "end" }>) => {
        const msg = event.data;
        if (msg.type === "tick") {
          // Discard ticks from a previous generation. After we send an
          // init/update message, the worker may have already queued tick
          // messages from the prior simulation; applying them would briefly
          // overwrite carefully-placed positions (e.g. DAG layout) and cause
          // a visible flash before the new sim takes over.
          if (msg.generation !== this.simGeneration) return;
          const pos = msg.positions;
          const ns = this.nodes;
          // Position buffer is sized to current node count; protect against
          // races where a stale tick arrives after node count changed.
          const n = Math.min(ns.length, pos.length / 2);
          for (let i = 0; i < n; i++) {
            ns[i].x = pos[i * 2];
            ns[i].y = pos[i * 2 + 1];
          }
          // While the layout is settling on first load, refit on every tick so
          // the camera continuously zooms out to keep the spreading graph in
          // view (instead of snapping once at the end).
          if (this.autoFitActive) {
            this.fitToNodes();
          }
          this.scheduleRender();
        } else if (msg.type === "end") {
          if (this.autoFitActive) {
            this.fitToNodes();
            this.autoFitActive = false;
          }
          this.scheduleRender();
        }
      };
    }

    const transfer: Transferable[] = [nodesBuf.buffer, linksBuf.buffer];
    if (dagAxis) transfer.push(dagAxis.buffer);
    if (depthBands) transfer.push(depthBands.buffer);

    this.simGeneration++;
    worker.postMessage(
      {
        type: canReuse ? "update" : "init",
        nodesBuf,
        linksBuf,
        dagMode: !!dagMode,
        isHorizontal: isHorizontalDag,
        dagAxis,
        // Soft pull (lerp) for animated natural→DAG transitions; the worker
        // auto-snaps to hard pin once nodes converge near the axis.
        dagAxisStrength: animatedDagTransition ? 0.15 : 1,
        depthBands,
        spread,
        // Cold start: full alpha. Warm restart (e.g. after rebuild button): 0.3.
        // In-place update (graphMode toggle, etc.): low alpha so layout barely shifts.
        // alphaOverride lets callers (e.g. DAG-mode transition) request a stronger kick.
        alpha: alphaOverride ?? (coldStart ? 1 : canReuse ? 0.15 : 0.3),
        // Skip link/charge in any DAG mode (constraint or radial layout dominates)
        useLink: !dagMode,
        useCharge: !dagMode,
        useCenter: !dagMode,
        alphaDecay: dagMode ? 0.005 : 0.008,
        alphaMin: dagMode ? 0.001 : 0.0001,
        velocityDecay: dagMode ? 0.3 : 0.4,
        generation: this.simGeneration,
      },
      transfer,
    );
    console.log(`[sim] postMessage ${canReuse ? "(update)" : "(init)"}: ${(performance.now() - t0).toFixed(1)}ms`);
  }

  /** Fit all nodes into the viewport with an animated zoom transition. */
  public fitToView(): void {
    this.fitToNodes();
  }

  /** Fit a subset of nodes (by id) into the viewport with an animated zoom. */
  public fitToNodeIds(ids: Iterable<string>, opts?: { maxScale?: number; padding?: number }): void {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    if (idSet.size === 0) return;
    this.fitToNodes((n) => idSet.has(n.id), opts);
  }

  /** Pan + zoom the camera to focus a single node, smoothly. */
  public focusNode(id: string, opts?: { scale?: number; duration?: number }): void {
    if (!this.zoomBehavior) return;
    const node = this.nodes.find((n) => n.id === id);
    if (!node || node.x == null || node.y == null) return;
    const targetScale = Math.max(this.transform.k, opts?.scale ?? 1.2);
    const { width, height } = this.options;
    const tx = width / 2 - targetScale * node.x;
    const ty = height / 2 - targetScale * node.y;
    const target = zoomIdentity.translate(tx, ty).scale(targetScale);
    this.transform = target;
    select(this.canvas)
      .transition()
      .duration(opts?.duration ?? 500)
      .ease(easeCubicOut)
      .call(this.zoomBehavior.transform, target);
  }

  /** Reset zoom/pan to identity (1:1 centered). */
  public resetView(): void {
    if (!this.zoomBehavior) return;
    const centered = zoomIdentity.translate(this.options.width / 2, this.options.height / 2);
    select(this.canvas)
      .transition()
      .duration(400)
      .ease(easeCubicOut)
      .call(this.zoomBehavior.transform, centered);
  }

  /** Programmatically zoom by a factor about the viewport centre. */
  public zoomBy(factor: number): void {
    if (!this.zoomBehavior) return;
    select(this.canvas).transition().duration(200).call(this.zoomBehavior.scaleBy, factor);
  }

  /** Current zoom scale (1 = native). */
  public getZoom(): number {
    return this.transform.k;
  }

  /** Export the current canvas frame as a PNG data URL. */
  public toDataURL(): string {
    return this.canvas.toDataURL("image/png");
  }

  /** Read-only snapshot of node positions for overview rendering (minimap). */
  public getNodePositions(): { id: string; x: number; y: number }[] {
    return this.nodes
      .filter((n) => n.x != null && n.y != null)
      .map((n) => ({ id: n.id, x: n.x as number, y: n.y as number }));
  }

  /** Current world-space viewport rectangle, for minimap overlays. */
  public getViewportRect(): { x: number; y: number; width: number; height: number } {
    const t = this.transform;
    return {
      x: -t.x / t.k,
      y: -t.y / t.k,
      width: this.options.width / t.k,
      height: this.options.height / t.k,
    };
  }

  private fitToNodes(filter?: (n: typeof this.nodes[number]) => boolean, opts?: { maxScale?: number; padding?: number }): void {
    if (!this.nodes.length || !this.zoomBehavior) return;
    const candidates = filter ? this.nodes.filter(filter) : this.nodes;
    if (!candidates.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of candidates) {
      const x = node.x ?? 0, y = node.y ?? 0;
      const hw = (node._width ?? 60) / 2, hh = (node._height ?? 20) / 2;
      if (x - hw < minX) minX = x - hw;
      if (y - hh < minY) minY = y - hh;
      if (x + hw > maxX) maxX = x + hw;
      if (y + hh > maxY) maxY = y + hh;
    }
    const padding = opts?.padding ?? 40;
    const maxScale = opts?.maxScale ?? 1;
    const bw = maxX - minX + padding * 2;
    const bh = maxY - minY + padding * 2;
    const { width, height } = this.options;
    const scale = Math.min(width / bw, height / bh, maxScale);
    const tx = width / 2 - scale * ((minX + maxX) / 2);
    const ty = height / 2 - scale * ((minY + maxY) / 2);
    const target = zoomIdentity.translate(tx, ty).scale(scale);

    // When auto-fit tracks the running simulation, apply the new transform
    // directly: the bounding box already changes smoothly tick-to-tick, and
    // a per-tick d3 transition would constantly interrupt itself and stutter.
    // For one-shot fits (e.g. user-triggered "fit to view"), animate.
    if (this.autoFitActive) {
      this.transform = target;
      select(this.canvas).call(this.zoomBehavior.transform, target);
    } else {
      this.transform = target;
      select(this.canvas)
        .transition()
        .duration(600)
        .ease(easeCubicOut)
        .call(this.zoomBehavior.transform, target);
    }
  }

  private stopSimulation(): void {
    if (this.simulationWorker) {
      try {
        this.simulationWorker.postMessage({ type: "stop" });
      } catch {}
      this.simulationWorker.terminate();
      this.simulationWorker = null;
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
      hoverNodeId: this.hoverNodeId ?? this.options.contextMenuNodeId ?? null,
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
export function computeTopoDepth(nodes: RenderNode[], links: ResolvedLink[]): Map<string, number> {
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

  // True topological depth never exceeds N-1. Cycles in the graph would
  // otherwise let depth keep increasing forever (re-queueing nodes), so
  // we hard-cap to bound the BFS.
  const maxAllowed = Math.max(0, nodes.length - 1);

  let i = 0;
  while (i < queue.length) {
    const id = queue[i++];
    const d = depth.get(id) ?? 0;
    if (d >= maxAllowed) continue;
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
