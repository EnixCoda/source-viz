import { forceCollide } from "d3";
import { DagMode, ForceGraphInstance, GraphData, LinkObject, NodeObject } from "force-graph";
import { carry } from "./general";
import { PreparedData } from "./getData";

export type GraphDecorator<Options> = (graph: ForceGraphInstance, options: Options) => void | (() => void);

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

export function getColorByDataMapper(graph: ForceGraphInstance, colorBy: string) {
  switch (colorBy) {
    case "depth": {
      return [colorByDepth(graph).mapData];
    }
    case "connection-both":
    case "connection-dependency":
    case "connection-dependant": {
      return [
        colorByHeat(
          graph,
          (
            {
              "connection-both": "both",
              "connection-dependency": "source",
              "connection-dependant": "target",
            } as const
          )[colorBy],
        ).mapData,
      ];
    }
  }
}

export const renderNodeAsText: GraphDecorator<{
  getSelection: () => NodeObject["id"] | null;
  fixedFontSize?: number;
}> = (graph, { getSelection, fixedFontSize }) => {
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
          backgroundDimensions[1] + (borderWidth * 2) / globalScale,
        );
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(
        node.x! - backgroundDimensions[0] / 2,
        node.y! - backgroundDimensions[1] / 2,
        ...backgroundDimensions,
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
          ...backgroundDimensions,
        );
      }
    });

  return () => {
    graph.nodeCanvasObject(undefined as any);
    graph.nodePointerAreaPaint(undefined as any);
  };
};

export const freezeNodeOnDragEnd: GraphDecorator<{}> = (graph) => {
  // Fix on drag end
  const fixedNodes = new Map<NodeObject["id"], Pick<NodeObject, "fx" | "fy">>();
  graph.onNodeDragEnd((node) => {
    fixedNodes.set(node.id, {
      fx: node.fx,
      fy: node.fy,
    });
    node.fx = node.x;
    node.fy = node.y;
  });

  return () => {
    graph.onNodeDragEnd(undefined as any);
    for (const [fixedNode, originalPosition] of fixedNodes) {
      const node = graph.graphData().nodes.find((node) => node.id === fixedNode);
      if (!node) continue;
      node.fx = originalPosition.fx;
      node.fy = originalPosition.fy;
    }
  };
};

export const highlightNodeOnHover: GraphDecorator<PreparedData> = (
  graph: ForceGraphInstance,
  { dependantMap, dependencyMap },
) => {
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

  return () => {
    graph.nodeCanvasObjectMode(undefined as any);
    graph.nodeCanvasObject(undefined as any);
  };
};

const getLinkObjectId = (object: LinkObject[keyof LinkObject]): NodeObject["id"] | undefined =>
  typeof object === "object" ? object?.id : object;

export const renderAsDAG: GraphDecorator<{
  dagMode: DagMode | null;
}> = (graph, { dagMode }) => {
  graph.dagMode(dagMode);
  if (dagMode) {
    graph.dagLevelDistance(120).d3Force("collide", forceCollide(0.12)).d3AlphaDecay(0.02).d3VelocityDecay(0.3);
    return () => {
      graph.dagLevelDistance(undefined as any);
      // below are not functions in cancel
      // .d3Force("collide", undefined as any)
      // .d3AlphaDecay(undefined as any)
      // .d3VelocityDecay(undefined as any);
    };
  }
};

export const selectNodeOnMouseDown: GraphDecorator<{
  onSelectNode: (id: NodeObject["id"] | null) => void;
}> = (graph, { onSelectNode }) => {
  graph
    .onNodeDrag((node) => set(node))
    .onNodeClick((node) => set(node))
    .autoPauseRedraw(false);

  function set(node: NodeObject) {
    onSelectNode(node.id || null);
  }

  return () => {
    graph.onNodeDrag(undefined as any);
    graph.onNodeClick(undefined as any);
  };
};
