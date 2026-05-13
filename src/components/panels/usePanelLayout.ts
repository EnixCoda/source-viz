import * as React from "react";
import { PanelDef, PanelId, Placement, PanelLayoutState } from "./types";

function initialState(defs: PanelDef[]): PanelLayoutState {
  const placement = new Map<PanelId, Placement>();
  const lastPlacement = new Map<PanelId, Exclude<Placement, "closed">>();
  for (const d of defs) {
    placement.set(d.id, d.defaultPlacement);
    lastPlacement.set(d.id, d.defaultPlacement);
  }
  return { placement, lastPlacement };
}

export type PanelLayoutAPI = {
  defs: PanelDef[];
  placementOf: (id: PanelId) => Placement;
  panelsAt: (zone: Exclude<Placement, "closed">) => PanelDef[];
  movePanel: (id: PanelId, to: Placement) => void;
  togglePanel: (id: PanelId) => void;
  closePanel: (id: PanelId) => void;
  isOpen: (id: PanelId) => boolean;
  /** Serializable snapshot for persistence. */
  snapshot: () => Record<PanelId, Placement>;
  restore: (snap: Record<PanelId, Placement> | undefined | null) => void;
};

export function usePanelLayout(defs: PanelDef[]): PanelLayoutAPI {
  const [state, setState] = React.useState<PanelLayoutState>(() => initialState(defs));

  // If new panels appear in defs (hot-reload, dynamic), seed them.
  React.useEffect(() => {
    setState(prev => {
      let changed = false;
      const placement = new Map(prev.placement);
      const lastPlacement = new Map(prev.lastPlacement);
      for (const d of defs) {
        if (!placement.has(d.id)) {
          placement.set(d.id, d.defaultPlacement);
          changed = true;
        }
        if (!lastPlacement.has(d.id)) {
          lastPlacement.set(d.id, d.defaultPlacement);
          changed = true;
        }
      }
      return changed ? { placement, lastPlacement } : prev;
    });
  }, [defs]);

  const placementOf = React.useCallback(
    (id: PanelId): Placement => state.placement.get(id) ?? "closed",
    [state.placement]
  );

  const panelsAt = React.useCallback(
    (zone: Exclude<Placement, "closed">): PanelDef[] =>
      defs.filter(d => (state.placement.get(d.id) ?? "closed") === zone),
    [defs, state.placement]
  );

  const movePanel = React.useCallback((id: PanelId, to: Placement) => {
    setState(prev => {
      const placement = new Map(prev.placement);
      const lastPlacement = new Map(prev.lastPlacement);
      placement.set(id, to);
      if (to !== "closed") lastPlacement.set(id, to);
      return { placement, lastPlacement };
    });
  }, []);

  const isOpen = React.useCallback(
    (id: PanelId): boolean => (state.placement.get(id) ?? "closed") !== "closed",
    [state.placement]
  );

  const togglePanel = React.useCallback((id: PanelId) => {
    setState(prev => {
      const def = defs.find(d => d.id === id);
      if (def?.alwaysOpen) return prev;
      const cur = prev.placement.get(id) ?? "closed";
      const placement = new Map(prev.placement);
      if (cur === "closed") {
        const last = prev.lastPlacement.get(id) ?? def?.defaultPlacement ?? "sidebar";
        placement.set(id, last);
      } else {
        placement.set(id, "closed");
      }
      return { ...prev, placement };
    });
  }, [defs]);

  const closePanel = React.useCallback((id: PanelId) => {
    setState(prev => {
      const def = defs.find(d => d.id === id);
      if (def?.alwaysOpen) return prev;
      const placement = new Map(prev.placement);
      placement.set(id, "closed");
      return { ...prev, placement };
    });
  }, [defs]);

  const snapshot = React.useCallback((): Record<PanelId, Placement> => {
    const out: Record<PanelId, Placement> = {};
    for (const [id, p] of state.placement) out[id] = p;
    return out;
  }, [state.placement]);

  const restore = React.useCallback((snap: Record<PanelId, Placement> | undefined | null) => {
    if (!snap) return;
    setState(prev => {
      const placement = new Map(prev.placement);
      const lastPlacement = new Map(prev.lastPlacement);
      for (const [id, p] of Object.entries(snap)) {
        placement.set(id, p);
        if (p !== "closed") lastPlacement.set(id, p);
      }
      return { placement, lastPlacement };
    });
  }, []);

  return { defs, placementOf, panelsAt, movePanel, togglePanel, closePanel, isOpen, snapshot, restore };
}
