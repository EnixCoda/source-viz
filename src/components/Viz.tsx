import * as React from "react";
import { useGraph } from "../hooks/useGraph";
import { useSet } from "../hooks/useSet";
import { useCheckboxView } from "../hooks/view/useCheckboxView";
import { useInputView } from "../hooks/view/useInputView";
import { useRegExpInputView } from "../hooks/view/useRegExpInputView";
import { useSelectView } from "../hooks/view/useSelectView";
import { getData, PreparedData } from "../utils/getData";
import { DAGDirections } from "../utils/graphDecorators";
import { CollapsibleSection } from "./CollapsibleSection";
import { FieldSetSection } from "./FieldSetSection";
import { NodeInView } from "./NodeInView";

export function Viz({ data }: { data: PreparedData }) {
  const [renderAsTextView, renderAsText] = useCheckboxView("Render as Text", true);
  const [fixNodeOnDragEndView, fixNodeOnDragEnd] = useCheckboxView("Fix node on drag end", true);
  const [dagPruneModeView, dagPruneMode] = useSelectView(
    "DAG Prune Mode: ",
    [
      { value: "less roots", label: "Less roots" },
      { value: "less leaves", label: "Less leaves" },
    ],
    "less roots"
  );
  const [dagModeView, dagMode] = useSelectView<DAGDirections | "">(
    "DAG Mode: ",
    [
      { value: "", label: "Disable (render circular references)" },
      { value: "lr", label: "Left to Right" },
      { value: "rl", label: "Right to Left" },
      { value: "td", label: "Top to Bottom" },
      { value: "bu", label: "Bottom to Top" },
      { value: "radialout", label: "Radial Out" },
      { value: "radialin", label: "Radial In" },
    ],
    "lr"
  );
  const [repositoryInputView, repositoryInput] = useInputView("", {
    placeholder: "/Users/name/repository/",
    style: { width: "100%" },
  });

  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInputView("test");
  const excludedNodesFromInput = React.useMemo(
    () => (excludeNodesFilterRegExp ? [...data.nodes.keys()].filter((dep) => dep.match(excludeNodesFilterRegExp)) : []),
    [data, excludeNodesFilterRegExp]
  );

  const [excludedDependantsNodes, toggleExcludeNodeDependants] = useSet<string>();
  const [excludedDependenciesNodes, toggleExcludeNodeDependencies] = useSet<string>();

  const toggleExcludeNode = React.useCallback(function toggleExcludeNode(id: string) {
    toggleExcludeNodeDependencies(id);
    toggleExcludeNodeDependants(id);
  }, []);

  const allExcludedNodes = React.useMemo(
    () => new Set([...excludedNodesFromInput, ...excludedDependantsNodes, ...excludedDependenciesNodes]),
    [excludedNodesFromInput, excludedDependantsNodes, excludedDependenciesNodes]
  );

  const [restrictRootInputView, restrictRootsRegExp] = useRegExpInputView("^antd$");
  const restrictedRoots = React.useMemo(
    () =>
      new Set(
        [...data.dependencies.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictRootsRegExp || id.match(restrictRootsRegExp))
        )
      ),
    [data, restrictRootsRegExp, allExcludedNodes]
  );

  const [restrictLeavesInputView, restrictLeavesRegExp] = useRegExpInputView();
  const restrictedLeaves = React.useMemo(
    () =>
      new Set(
        [...data.nodes.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictLeavesRegExp || id.match(restrictLeavesRegExp))
        )
      ),
    [data, restrictLeavesRegExp, allExcludedNodes]
  );

  const [ref, render, selectedNode, setSelectedNode] = useGraph({
    dagMode,
    fixNodeOnDragEnd,
    renderAsText,
  });
  const getDataOptions = React.useMemo(
    () => ({
      roots: restrictedRoots,
      leaves: restrictedLeaves,
      preventCycle: dagMode !== null,
      dagPruneMode,
      excludeUp: allExcludedNodes,
      excludeDown: allExcludedNodes,
    }),
    [dagMode, dagPruneMode, restrictedRoots, restrictedLeaves, allExcludedNodes]
  );
  const renderData = React.useMemo(() => getData(data, getDataOptions), [data, getDataOptions]);
  React.useEffect(() => {
    render?.(renderData);
  }, [render, renderData]);

  const renderedNodeIds = React.useMemo(() => renderData?.nodes.map((node) => node.id as string), [renderData.nodes]);

  const leavesInView = React.useMemo(
    () => renderedNodeIds.filter((id) => renderData.links.every(({ target }) => target !== id)),
    [renderedNodeIds, renderData.links]
  );

  const rootsInView = React.useMemo(
    () => renderedNodeIds.filter((id) => renderData.links.every(({ source }) => source !== id)),
    [renderedNodeIds, renderData.links]
  );

  const [nodesInViewInputView, nodesInViewRegExp] = useRegExpInputView();
  const nodesInView = React.useMemo(
    () => renderedNodeIds.filter((id) => !nodesInViewRegExp || id.match(nodesInViewRegExp)),
    [renderedNodeIds]
  );

  return (
    <div>
      <div style={{ display: "flex", maxWidth: "100vw", overflow: "auto" }}>
        <div className="col-2">
          <CollapsibleSection className="row-1" open label={<>Viz configs</>}>
            <div>{dagPruneModeView}</div>
            <div>{dagModeView}</div>
            <div>{renderAsTextView}</div>
            <div>{fixNodeOnDragEndView}</div>
          </CollapsibleSection>
          <CollapsibleSection className="row-1" open label={<>Selected Node</>}>
            <div>
              <code>{selectedNode}</code>
            </div>
            {selectedNode && (
              <>
                <FieldSetSection label={<legend>Open in VS Code</legend>}>
                  {repositoryInputView}
                  <div>
                    <a
                      href={
                        repositoryInput && selectedNode.includes("/")
                          ? `vscode://file${repositoryInput + selectedNode}`
                          : "#"
                      }
                    >
                      {repositoryInput && selectedNode.includes("/") ? "Open" : "Cannot open 3rd party dependency"}
                    </a>
                  </div>
                </FieldSetSection>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      style={{ position: "static" }}
                      checked={
                        excludedDependantsNodes.some((id) => id === selectedNode) ||
                        excludedDependenciesNodes.some((id) => id === selectedNode)
                      }
                      onChange={(e) => toggleExcludeNode(selectedNode)}
                    />
                    Exclude
                  </label>
                </div>
                {/* excludedDependants: excludedDependantsNodes.some(
                      (id) => id === selectedNode
                    ),
                    excludedDependencies: excludedDependenciesNodes.some(
                      (id) => id === selectedNode
                    ), */}
                <h4>Dependencies</h4>
                <div>
                  {[...(data.dependencyMap.get(selectedNode) || [])]
                    .filter((id) => renderData?.nodes.some((node) => id === node.id))
                    .map((id) => (
                      <div key={id} className="node-item">
                        <button onClick={() => setSelectedNode(id)}>Select</button> <span>{id}</span>
                      </div>
                    ))}
                </div>
                <h4>Dependants</h4>
                <div>
                  {[...(data.dependantMap.get(selectedNode) || [])]
                    .filter((id) => renderData?.nodes.some((node) => id === node.id))
                    .map((id) => (
                      <div key={id} className="node-item">
                        <button onClick={() => setSelectedNode(id)}>Select</button>
                        <span> {id}</span>
                      </div>
                    ))}
                </div>
                {/* <button onClick={() => excludeNodeDependants(selectedNode)}>
                      Toggle exclude its dependants
                    </button>
                    <button onClick={() => excludeNodeDependencies(selectedNode)}>
                      Toggle exclude its dependencies
                    </button> */}
                {false && <button disabled>TODO: Add to root nodes</button>}
              </>
            )}
          </CollapsibleSection>
        </div>
        <div className="col-2">
          <CollapsibleSection className="row-1" label={<>Restrict Root Nodes</>}>
            {restrictRootInputView}
            {[...restrictedRoots]?.map((id) => (
              <NodeInView key={id} label={<span>{id}</span>} />
            ))}
          </CollapsibleSection>
          <CollapsibleSection className="row-1" label={<>Root Nodes in View</>}>
            {rootsInView?.map((id) => (
              <NodeInView
                key={id}
                onExclude={() => toggleExcludeNodeDependants(id)}
                onSelect={() => setSelectedNode(id)}
                label={<span>{id}</span>}
              />
            ))}
          </CollapsibleSection>
        </div>
        <div className="col-2">
          <CollapsibleSection className="row-1" open label={<>Restrict Leaf Nodes</>}>
            {restrictLeavesInputView}
            {[...restrictedLeaves]?.map((id) => (
              <NodeInView key={id} label={<span>{id}</span>} />
            ))}
          </CollapsibleSection>
          <CollapsibleSection className="row-1" label={<>Leaf Nodes in View</>}>
            {leavesInView?.map((id) => (
              <NodeInView
                key={id}
                onExclude={() => toggleExcludeNodeDependencies(id)}
                onSelect={() => setSelectedNode(id)}
                label={<span>{id}</span>}
              />
            ))}
          </CollapsibleSection>
        </div>
        <div className="col-2">
          <CollapsibleSection className="row-1" label={<>Exclude Nodes</>}>
            <h4>Exclude Dependants of Them</h4>
            {excludedDependantsNodes.map((id) => (
              <NodeInView key={id} label={id} onCancel={() => toggleExcludeNodeDependants(id)} />
            ))}
            <h4>Exclude Dependencies of Them</h4>
            {excludedDependenciesNodes.map((id) => (
              <NodeInView key={id} label={id} onCancel={() => toggleExcludeNodeDependencies(id)} />
            ))}
            <h4>Exclude with regex</h4>
            {excludeNodesFilterInputView}
            {excludedNodesFromInput?.map((id) => (
              <NodeInView key={id} label={<span>{id}</span>} />
            ))}
          </CollapsibleSection>
          <CollapsibleSection
            className="row-1"
            label={<>Look up nodes in view ({renderData?.nodes.length || 0} in total)</>}
          >
            {nodesInViewInputView}
            {nodesInView?.map((id) => (
              <NodeInView
                key={id}
                onExclude={() => toggleExcludeNode(id)}
                onSelect={() => setSelectedNode(id)}
                label={<span>{id}</span>}
              />
            ))}
          </CollapsibleSection>
        </div>
      </div>
      <div ref={ref} />
    </div>
  );
}
