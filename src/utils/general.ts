import { Order } from "../types";

export function safeRegExp(raw: string, flags: string = "") {
  try {
    return raw ? new RegExp(raw, flags) : null;
  } catch (error) {
    return false;
  }
}

export const safeMapGet = <K, V>(map: Map<K, V>, key: K, initialize: () => V) => {
  let value = map.get(key);
  if (!value) map.set(key, (value = initialize()));
  return value;
};

export const run = <R>(fn: () => R) => fn();

export const carry = <T, R>(t: T, f: (t: T) => R): R => f(t);

export const switchRender = <K extends string>(map: Partial<Record<K, () => React.ReactNode>>, state: K) =>
  map[state]?.();

export const isNotFalse = <T>(t: false | T): t is T => t !== false;
export const isNotFalsy = <T>(t: false | undefined | null | T): t is T => t !== false && t !== undefined && t !== null;

export function download(data: BlobPart, filename: string, type?: string) {
  const file = new Blob([data], { type: type });
  const url = URL.createObjectURL(file);
  const anchorElement = document.createElement("a");
  anchorElement.href = url;
  anchorElement.download = filename;
  document.body.appendChild(anchorElement);
  anchorElement.click();
  setTimeout(() => {
    document.body.removeChild(anchorElement);
    window.URL.revokeObjectURL(url);
  }, 0);
}

export const clamp = (value: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) =>
  Math.max(min, Math.min(value, max));

export const compareStrings = (a: string, b: string, order: Order = "asc") =>
  (order === "asc" ? 1 : -1) * (a === b ? 0 : a > b ? 1 : -1);
