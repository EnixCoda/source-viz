import * as React from "react";

export type PanelId = string;

export type Placement = "primary" | "secondary" | "sidebar" | "closed";

export type PanelDef = {
  id: PanelId;
  label: string;
  icon: React.ReactElement;
  badge?: React.ReactNode;
  defaultPlacement: Exclude<Placement, "closed">;
  /** When true, panel cannot be closed (e.g. Viz). */
  alwaysOpen?: boolean;
};

export type PanelLayoutState = {
  /** Current placement of every panel. Panels not in the map are "closed". */
  placement: Map<PanelId, Placement>;
  /** Last non-closed placement, used when re-opening a closed panel. */
  lastPlacement: Map<PanelId, Exclude<Placement, "closed">>;
};
