import { GraphData } from "force-graph";
import * as React from "react";
import { render } from "react-dom";
import { createRoot } from "react-dom/client";
import rawData from "../out.json";
import { createGraphRenderer } from "./ForceGraphBinding";
import { getData, prepareGraphData } from "./getData";
import {
  colorByDepth,
  DAGDirections,
  freezeNodeOnDragEnd,
  highlightNodeOnHover,
  renderAsDAG,
  renderNodeAsText,
  selectNodeOnMouseDown
} from "./graphDecorators";
import "./style.css";

const simpleTestData = [
  ["a", "b"],
  ["d", "b"],
  ["b", "c"],
  ["b", "e"],
];

const preparedData = prepareGraphData(simpleTestData && rawData);

const invalidRegExp = new RegExp(`$^`);
function safeRegExp(raw: string) {
  try {
    return new RegExp(raw, "i");
  } catch (error) {
    return invalidRegExp; // match nothing
  }
}

function useSet<T>() {
  const [values, setValues] = React.useState<T[]>([]);
  const toggle = React.useCallback(function toggle(value: T) {
    setValues((values) => {
      return values.includes(value) ? values.filter((n) => n !== value) : [...values, value];
    });
  }, []);

  return [values, toggle] as const;
}

function useRender<T extends any[]>(renderer: (...states: T) => React.ReactNode, states: T) {
  return React.useMemo(() => renderer(...states), states);
}

function useStateWithRender<T>(
  defaultValue: T,
  render: (state: T, setState: React.Dispatch<React.SetStateAction<T>>, ...deps: any[]) => React.ReactNode,
  deps: any[] = []
) {
  const [state, setState] = React.useState(defaultValue);
  const view = useRender(render, [state, setState, ...deps]);
  return [view, state, setState] as const;
}

function useCheckboxView(label: React.ReactNode, defaultValue: boolean) {
  return useStateWithRender(
    defaultValue,
    (checked, setChecked) => (
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        {label}
      </label>
    ),
    [label]
  );
}

function useSelectView<T extends string>(
  label: React.ReactNode,
  options: { label: React.ReactNode; value: T }[],
  defaultValue: T
) {
  return useStateWithRender<T>(
    defaultValue,
    (value, setState) => (
      <label>
        <span>{label}</span>
        <select value={value} onChange={(e) => setState(e.target.value as typeof value)}>
          {options.map(({ label, value }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    ),
    [label, options]
  );
}

function useInput(defaultValue: string = "", inputProps?: React.InputHTMLAttributes<HTMLInputElement>) {
  const [inputView, inputValue] = useStateWithRender(defaultValue, (state, setState) => (
    <input {...inputProps} value={state} onChange={(e) => setState(e.target.value)} />
  ));
  const view = React.useMemo(() => <>{inputView}</>, [inputView, inputValue]);

  return [view, inputValue] as const;
}

function useRegExpInput(defaultValue: string = "") {
  const [inputView, inputValue] = useStateWithRender(defaultValue, (state, setState) => (
    <input placeholder="RegEx supported" value={state} onChange={(e) => setState(e.target.value)} />
  ));
  const [regExp, setRegExp] = React.useState<RegExp | null>(null);
  React.useEffect(() => {
    const r = safeRegExp(inputValue);
    if (r !== invalidRegExp) setRegExp(r);
  }, [inputValue]);
  const view = React.useMemo(
    () => (
      <>
        {inputView}
        {regExp === invalidRegExp ? "Invalid RegExp" : null}
      </>
    ),
    [inputView, inputValue, regExp]
  );

  return [view, regExp, inputValue] as const;
}

function useGraph({
  dagMode,
  renderAsText,
  fixNodeOnDragEnd,
}: {
  dagMode: DAGDirections | "";
  renderAsText: boolean;
  fixNodeOnDragEnd: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [selectedNodeInState, setSelectedNodeInState] = React.useState<string | null>(null);
  const [render, setRender] = React.useState<ReturnType<typeof createGraphRenderer>["render"] | null>(null);
  const selectedNodeRef = React.useRef<string | null>(null);
  const setNodeSelection = React.useCallback((id: string | null): void => {
    setSelectedNodeInState(id);
    selectedNodeRef.current = id;
  }, []);

  React.useEffect(() => {
    if (!ref.current) {
      setRender(null);
      return;
    }

    const { graph, render } = createGraphRenderer(ref.current);

    // start decorating graph
    graph.width(window.innerWidth).height(window.innerHeight / 2);

    const dataMappers: (({ nodes, links }: GraphData) => GraphData)[] = [];

    dataMappers.push(colorByDepth(graph).mapData);

    if (fixNodeOnDragEnd) freezeNodeOnDragEnd(graph);

    if (dagMode) renderAsDAG(graph, dagMode);

    if (renderAsText) renderNodeAsText(graph, () => selectedNodeRef.current);
    else highlightNodeOnHover(graph, preparedData);

    selectNodeOnMouseDown(graph, setNodeSelection);

    // preprocess data for rendering
    const mapData = (data: GraphData) => dataMappers.reduce((prev, mapData) => mapData(prev), data);

    setRender(() => (data: GraphData) => render(mapData(data)));

    return () => graph._destructor();
  }, [fixNodeOnDragEnd, dagMode, renderAsText]);

  return [ref, render, selectedNodeInState, setNodeSelection] as const;
}

const App = () => {
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
  const [repositoryInputView, repositoryInput] = useInput("", {
    placeholder: "/Users/name/repository/",
    style: { width: "100%" },
  });

  const [excludeNodesFilterInputView, excludeNodesFilterRegExp] = useRegExpInput("test");
  const excludedNodesFromInput = React.useMemo(
    () =>
      excludeNodesFilterRegExp
        ? [...preparedData.nodes.keys()].filter((dep) => dep.match(excludeNodesFilterRegExp))
        : [],
    [excludeNodesFilterRegExp]
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

  const [restrictRootInputView, restrictRootsRegExp] = useRegExpInput("^antd$");
  const restrictedRoots = React.useMemo(
    () =>
      new Set(
        [...preparedData.dependencies.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictRootsRegExp || id.match(restrictRootsRegExp))
        )
      ),
    [restrictRootsRegExp, allExcludedNodes]
  );

  const [restrictLeavesInputView, restrictLeavesRegExp] = useRegExpInput();
  const restrictedLeaves = React.useMemo(
    () =>
      new Set(
        [...preparedData.nodes.keys()].filter(
          (id) => !allExcludedNodes.has(id) && (!restrictLeavesRegExp || id.match(restrictLeavesRegExp))
        )
      ),
    [restrictLeavesRegExp, allExcludedNodes]
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
  const renderData = React.useMemo(() => getData(preparedData, getDataOptions), [getDataOptions]);
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

  const [nodesInViewInputView, nodesInViewRegExp] = useRegExpInput();
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
                <fieldset>
                  <legend>Open in VS Code</legend>
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
                </fieldset>
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
                {/* // excludedDependants: excludedDependantsNodes.some(
                    //   (id) => id === selectedNode
                    // ),
                    // excludedDependencies: excludedDependenciesNodes.some(
                    //   (id) => id === selectedNode
                    // ), */}
                <h4>Dependencies</h4>
                <div>
                  {[...(preparedData.dependencyMap.get(selectedNode) || [])]
                    .filter((id) => renderData?.nodes.some((node) => id === node.id))
                    .map((id) => (
                      <div key={id} className="node-item">
                        <button onClick={() => setSelectedNode(id)}>Select</button> <span>{id}</span>
                      </div>
                    ))}
                </div>
                <h4>Dependants</h4>
                <div>
                  {[...(preparedData.dependantMap.get(selectedNode) || [])]
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
};

const renderMode = [17, 18][1];
if (renderMode === 18) createRoot(document.querySelector("#app")!).render(<App />);
else render(<App />, document.querySelector("#app")!);

function CollapsibleSection({
  label,
  children,
  ...rest
}: { label: React.ReactNode; children: React.ReactNode } & React.DetailedHTMLProps<
  React.DetailsHTMLAttributes<HTMLDetailsElement>,
  HTMLDetailsElement
>) {
  return (
    <details {...rest}>
      <summary>{label}</summary>
      {children}
    </details>
  );
}

function FieldSetSection({
  label,
  children,
  ...rest
}: { label: React.ReactNode; children: React.ReactNode } & React.HTMLAttributes<HTMLFieldSetElement>) {
  return (
    <fieldset {...rest}>
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

function JSONViewer({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function NodeInView({
  label,
  onExclude,
  onSelect,
  onCancel,
}: {
  label: React.ReactNode;
  onExclude?: () => void;
  onSelect?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="node-item">
      {onExclude && <button onClick={onExclude}>Exclude</button>}
      {onCancel && <button onClick={onCancel}>Cancel</button>}
      {onSelect && <button onClick={onSelect}>Select</button>} <span>{label}</span>
    </div>
  );
}

function exclude<T>(sources: T[], targets: T[]): T[] {
  return sources.filter((source) => !targets.some((target) => source === target));
}
