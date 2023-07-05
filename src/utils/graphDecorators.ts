import { forceCollide } from "d3";
import { DagMode, ForceGraphInstance, GraphData, LinkObject, NodeObject } from "force-graph";
import { carry } from "./general";
import { PreparedData } from "./getData";

export function colorByHeat(graph: ForceGraphInstance, mode: "source" | "target" | "both") {
  type NodeObjectWithHeat = NodeObject & {
    heat?: number;
  };

  const mapData = (graphData: GraphData) => {
    graph.nodeAutoColorBy("heat");

    const getId = (node: LinkObject["source"] | LinkObject["target"]) => (typeof node === "string" ? node : node?.id);

    const countMap = new Map<NodeObject["id"], number>();
    graphData.links.forEach((link) => {
      if (mode !== "target") {
        const source = getId(link.source);
        if (source !== undefined) countMap.set(source, (countMap.get(source) || 0) + 1);
      }
      if (mode !== "source") {
        const target = getId(link.target);
        if (target !== undefined) countMap.set(target, (countMap.get(target) || 0) + 1);
      }
    });

    graphData.nodes.forEach((node) => ((node as NodeObjectWithHeat).heat = (node.id && countMap.get(node.id)) || 0));

    return graphData;
  };

  return {
    mapData,
  };
}

export function colorByDepth(graph: ForceGraphInstance) {
  type NodeObjectWithDepth = NodeObject & {
    depth: number;
  };

  const getDepth = (node: NodeObject) => [...(node.id?.matchAll(/\//g) || [])].length;
  graph.nodeAutoColorBy("depth");

  const mapData = ({ nodes, links }: GraphData) => {
    nodes.forEach((node) => ((node as NodeObjectWithDepth).depth ||= getDepth(node)));

    return {
      nodes,
      links,
    };
  };

  return {
    mapData,
  };
}

export function renderNodeAsText(
  graph: ForceGraphInstance,
  getSelection: () => NodeObject["id"] | null,
  fixedFontSize?: number
) {
  type NodeObjectWithColor = NodeObject & {
    color?: string;
  };

  const backgroundDimensionsMap = new Map<NodeObject["id"], [number, number]>();
  graph
    .nodeCanvasObject(($node, ctx, globalScale) => {
      const node = $node as NodeObjectWithColor;

      const label = node.id;
      const fontSize = fixedFontSize ?? 12 / globalScale;
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
      if (node.color) ctx.fillStyle = node.color;
      ctx.fillText(label, node.x!, node.y!);

      backgroundDimensionsMap.set(node.id, backgroundDimensions); // to re-use in nodePointerAreaPaint
    })
    .nodePointerAreaPaint((node, color, ctx) => {
      const backgroundDimensions = backgroundDimensionsMap.get(node.id);
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
  const highlightNodes = new Set<NodeObject["id"]>();
  let hoverNode: NodeObject["id"] | null = null;

  graph
    .onNodeHover((node) => {
      highlightNodes.clear();
      if (node) {
        const id = node.id;
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
        carry(getLinkObjectId(link.source), (id) => {
          if (id) highlightNodes.add(id);
        });

        carry(getLinkObjectId(link.target), (id) => {
          if (id) highlightNodes.add(id);
        });
      }
    })
    .autoPauseRedraw(false) // keep redrawing after engine has stopped
    .nodeCanvasObjectMode((node) => (highlightNodes.has(node.id) ? "before" : undefined))
    .nodeCanvasObject((node, ctx) => {
      // add ring just for highlighted nodes
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, 6, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.id === hoverNode ? "red" : "orange";
      ctx.fill();
    });
}

function getLinkObjectId(object: LinkObject[keyof LinkObject]): NodeObject["id"] | undefined {
  return typeof object === "object" ? object?.id : object;
}

export function renderAsDAG(graph: ForceGraphInstance, direction: DagMode | null = "lr") {
  graph.dagMode(direction);
  if (direction)
    graph.dagLevelDistance(120).d3Force("collide", forceCollide(0.12)).d3AlphaDecay(0.02).d3VelocityDecay(0.3);
}

export function selectNodeOnMouseDown(graph: ForceGraphInstance, setSelection: (id: NodeObject["id"] | null) => void) {
  graph
    .onNodeDrag((node) => set(node))
    .onNodeClick((node) => set(node))
    .autoPauseRedraw(false);

  function set(node: NodeObject) {
    setSelection(node.id || null);
  }
}
