import { forceCollide } from "d3";
import { ForceGraphInstance, GraphData, NodeObject } from "force-graph";
import { PreparedData } from "./getData";

export function colorByDepth(graph: ForceGraphInstance) {
  const getDepth = (node: NodeObject) => [...((node.id as string).matchAll(/\//g) || [])].length;
  graph.nodeAutoColorBy("depth");

  const mapData = ({ nodes, links }: GraphData) => {
    nodes.forEach((node: NodeObject) => ((node as NodeObject & { depth: number }).depth = getDepth(node)));

    return {
      nodes,
      links,
    };
  };

  return {
    mapData,
  };
}

export function renderNodeAsText(graph: ForceGraphInstance, getSelection: () => string | null) {
  const backgroundDimensionsMap = new Map<string, [number, number]>();
  graph
    .nodeCanvasObject((node, ctx, globalScale) => {
      const label = node.id as string;
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;
      const textWidth = ctx.measureText(label).width;
      const backgroundDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.2) as [number, number]; // some padding

      if (getSelection() === node.id) {
        ctx.fillStyle = "#ff0000";
        const borderWidth = 4;
        ctx.fillRect(
          node.x! - backgroundDimensions[0] / 2 - borderWidth / globalScale,
          node.y! - backgroundDimensions[1] / 2 - borderWidth / globalScale,
          backgroundDimensions[0] + (borderWidth * 2) / globalScale,
          backgroundDimensions[1] + (borderWidth * 2) / globalScale
        );
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(
        node.x! - backgroundDimensions[0] / 2,
        node.y! - backgroundDimensions[1] / 2,
        ...backgroundDimensions
      );

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = (node as any).color;
      ctx.fillText(label, node.x!, node.y!);

      backgroundDimensionsMap.set(node.id as string, backgroundDimensions); // to re-use in nodePointerAreaPaint
    })
    .nodePointerAreaPaint((node, color, ctx) => {
      const backgroundDimensions = backgroundDimensionsMap.get(node.id as string);
      if (backgroundDimensions) {
        ctx.fillStyle = color;
        ctx.fillRect(
          node.x! - backgroundDimensions[0] / 2,
          node.y! - backgroundDimensions[1] / 2,
          ...backgroundDimensions
        );
      }
    });
}

export function freezeNodeOnDragEnd(graph: ForceGraphInstance) {
  // Fix on drag end
  graph.onNodeDragEnd((node) => {
    node.fx = node.x;
    node.fy = node.y;
  });
}

export function highlightNodeOnHover(graph: ForceGraphInstance, { dependantMap, dependencyMap }: PreparedData) {
  const highlightNodes = new Set<string>();
  let hoverNode: string | null = null;

  graph
    .onNodeHover((node) => {
      highlightNodes.clear();
      if (node) {
        const id = node.id as string;
        highlightNodes.add(id);
        dependantMap.get(id)?.forEach((child) => highlightNodes.add(child));
        dependencyMap.get(id)?.forEach((parent) => highlightNodes.add(parent));
        hoverNode = id;
      } else {
        hoverNode = null;
      }
    })
    .onLinkHover((link) => {
      highlightNodes.clear();

      if (link) {
        highlightNodes.add(link.source as string);
        highlightNodes.add(link.target as string);
      }
    })
    .autoPauseRedraw(false) // keep redrawing after engine has stopped
    .nodeCanvasObjectMode((node) => (highlightNodes.has(node.id as string) ? "before" : undefined))
    .nodeCanvasObject((node, ctx) => {
      // add ring just for highlighted nodes
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, 6, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.id === hoverNode ? "red" : "orange";
      ctx.fill();
    });
}

export type DAGDirections = "td" | "bu" | "lr" | "rl" | "radialout" | "radialin";

export function renderAsDAG(graph: ForceGraphInstance, direction: DAGDirections = "lr") {
  graph
    .dagMode(direction)
    .dagLevelDistance(120)
    .d3Force("collide", forceCollide(0.12))
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3);
}

export function selectNodeOnMouseDown(graph: ForceGraphInstance, setSelection: (id: string | null) => void) {
  graph
    .onNodeDrag((node) => set(node))
    .onNodeClick((node) => set(node))
    .autoPauseRedraw(false);

  function set(node: NodeObject) {
    setSelection(node.id as string);
  }
}
