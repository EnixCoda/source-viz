import React from "react";

export interface SelectionContextValue {
  selectedNodes: Set<string>;
  setSelectedNodes: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  /** Convenience: select exactly one node (or clear if null). */
  setSelectedNode: (id: string | null) => void;
  /** Single-selection view; null when 0 or >1 nodes selected. */
  selectedNode: string | null;
  /** Toggle one node in/out of the selection (Ctrl/Cmd multi-select). */
  toggleSelectNode: (id: string) => void;
  clearSelection: () => void;
}

export const SelectionContext = React.createContext<SelectionContextValue | null>(null);

export function useSelection(): SelectionContextValue {
  const ctx = React.useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedNodes, setSelectedNodes] = React.useState<Set<string>>(new Set());

  const selectedNode = selectedNodes.size === 1 ? [...selectedNodes][0] : null;

  const setSelectedNode = React.useCallback((id: string | null) => {
    setSelectedNodes(id ? new Set([id]) : new Set());
  }, []);

  const toggleSelectNode = React.useCallback((id: string) => {
    setSelectedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedNodes(new Set());
  }, []);

  const value = React.useMemo(
    (): SelectionContextValue => ({
      selectedNodes,
      setSelectedNodes,
      setSelectedNode,
      selectedNode,
      toggleSelectNode,
      clearSelection,
    }),
    [selectedNodes, setSelectedNodes, setSelectedNode, selectedNode, toggleSelectNode, clearSelection]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}
