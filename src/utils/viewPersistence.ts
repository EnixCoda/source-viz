import { DependencyEntry } from "../services/serializers";

export type PersistedView = {
  panelWidth?: number;
  vizMode?: "graph" | "table" | "split";
  dockId?: string | null;
  excludeRegex?: string;
  rootsRegex?: string;
  leavesRegex?: string;
  excludedNodes?: string[];
  graphMode?: string;
  groupByDir?: boolean;
  groupDepth?: number;
};

export type PersistedDoc = {
  lastView: PersistedView;
  savedViews: { name: string; createdAt: number; view: PersistedView }[];
};

const KEY_PREFIX = "source-viz:v1:";

/** Cheap fingerprint of the dataset so views stay scoped to the project. */
export function datasetSignature(entries: DependencyEntry[]): string {
  if (entries.length === 0) return "empty";
  const first = entries[0]?.[0] ?? "";
  const last = entries[entries.length - 1]?.[0] ?? "";
  // FNV-ish over [length, first, last]
  let h = 2166136261 >>> 0;
  const s = `${entries.length}|${first}|${last}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

function load(sig: string): PersistedDoc {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + sig);
    if (!raw) return { lastView: {}, savedViews: [] };
    const parsed = JSON.parse(raw);
    return {
      lastView: parsed?.lastView ?? {},
      savedViews: Array.isArray(parsed?.savedViews) ? parsed.savedViews : [],
    };
  } catch {
    return { lastView: {}, savedViews: [] };
  }
}

function save(sig: string, doc: PersistedDoc): void {
  try {
    localStorage.setItem(KEY_PREFIX + sig, JSON.stringify(doc));
  } catch {
    // quota or disabled — silent
  }
}

export function loadLastView(sig: string): PersistedView {
  return load(sig).lastView;
}

export function saveLastView(sig: string, view: PersistedView): void {
  const doc = load(sig);
  doc.lastView = view;
  save(sig, doc);
}

export function listSavedViews(sig: string) {
  return load(sig).savedViews;
}

export function addSavedView(sig: string, name: string, view: PersistedView) {
  const doc = load(sig);
  doc.savedViews = doc.savedViews.filter((v) => v.name !== name);
  doc.savedViews.unshift({ name, createdAt: Date.now(), view });
  doc.savedViews = doc.savedViews.slice(0, 20);
  save(sig, doc);
  return doc.savedViews;
}

export function removeSavedView(sig: string, name: string) {
  const doc = load(sig);
  doc.savedViews = doc.savedViews.filter((v) => v.name !== name);
  save(sig, doc);
  return doc.savedViews;
}
