/* eslint-disable @typescript-eslint/no-explicit-any */
import { forceCollide } from "d3";
import { DagMode, ForceGraphInstance, LinkObject, NodeObject } from "force-graph";
import { PreparedData } from "./graphData";
import { ColorByMode } from "./graphDataMappers";

export type GraphDecorator<Options> = (graph: ForceGraphInstance, options: Options) => void | (() => void);

const colors = {
  selection: "rgba(255, 0, 0, 0.5)",
  hovered: "rgba(200, 200, 0, 0.5)",
  dependant: "rgba(0, 200, 200, 0.5)",
  dependency: "rgba(200, 0, 200, 0.5)",
};

export const renderNodeAsText: GraphDecorator<{
  getSelectionId: () => NodeObject["id"] | null;
  fontSize: number;
  fixFontSize?: boolean;
  data: PreparedData;
}> = (graph, { data, getSelectionId, fixFontSize, fontSize: preferFontSize }) => {
  type NodeObjectWithColor = NodeObject & {
    color?: string;
  };
  let hoverNodeId: NodeObject["id"] | null = null;

  const backgroundDimensionsMap = new Map<NodeObject["id"], [number, number]>();
  graph
    .nodeCanvasObject(($node, ctx, globalScale) => {
      const node = $node as NodeObjectWithColor;

      const label = node.id;
      const fontSize = fixFontSize ? preferFontSize : preferFontSize / globalScale;
      ctx.font = `${fontSize}px Sans-Serif`;

      const x = node.x!;
      const y = node.y!;
      const textWidth = ctx.measureText(label).width;
      const backgroundDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.2) as [number, number]; // some padding
      const [backgroundWidth, backgroundHeight] = backgroundDimensions;

      const selectionId = getSelectionId();
      const borderWidth = 4;

      const fillOutline = (fillStyle: string) => {
        ctx.fillStyle = fillStyle;
        ctx.fillRect(
          x - backgroundWidth / 2 - borderWidth / globalScale,
          y - backgroundHeight / 2 - borderWidth / globalScale,
          backgroundWidth + (borderWidth * 2) / globalScale,
          backgroundHeight + (borderWidth * 2) / globalScale
        );
      };

      let fillColor: string | null = null;
      if (selectionId === node.id) {
        fillColor = colors.selection;
      } else if (hoverNodeId) {
        if (hoverNodeId === node.id) {
          fillColor = colors.hovered;
        } else {
          if (data.dependantMap.get(hoverNodeId)?.has(node.id)) {
            fillColor = colors.dependant;
          } else if (data.dependencyMap.get(hoverNodeId)?.has(node.id)) {
            fillColor = colors.dependency;
          }
        }
      }
      if (fillColor) {
        fillOutline(fillColor);
      }

      // fill background
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.fillRect(x - backgroundWidth / 2, y - backgroundHeight / 2, ...backgroundDimensions);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (node.color) ctx.fillStyle = node.color;
      ctx.fillText(label, x, y);

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
    })
    .onNodeHover((node) => {
      hoverNodeId = node ? node.id : null;
    });

  return () => {
    graph.nodeCanvasObject(undefined as any);
    graph.nodePointerAreaPaint(undefined as any);
    graph.nodeCanvasObjectMode(undefined as any);
  };
};

export const freezeNodeOnDragEnd: GraphDecorator<Record<string, never>> = (graph) => {
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

export const getLinkObjectId = (object: LinkObject[keyof LinkObject]): NodeObject["id"] | undefined =>
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
    .onNodeDrag((node) => {
      onSelectNode(node.id || null);
    })
    .onNodeClick((node) => {
      onSelectNode(node.id || null);
    })
    .autoPauseRedraw(false);

  return () => {
    graph.onNodeDrag(undefined as any);
    graph.onNodeClick(undefined as any);
  };
};

export const decorateForColorBy: GraphDecorator<ColorByMode> = (graph, key) => {
  graph.nodeAutoColorBy(key);

  return () => {
    graph.nodeAutoColorBy(undefined as any);
  };
};
