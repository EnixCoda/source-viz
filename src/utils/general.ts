import { MetaFilter } from "../services";
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

export function exclude<T>(sources: T[], targets: T[]): T[] {
  return sources.filter((source) => !targets.some((target) => source === target));
}

export function run<R>(fn: () => R) {
  return fn();
}

export function switchRender<K extends string>(map: Partial<Record<K, () => React.ReactNode>>, state: K) {
  return map[state]?.();
}

export const resolvePath = (...ps: string[]): string =>
  new URL(ps.join("/").replace(/\/+/g, "/"), "http://localhost").pathname.replace(/^\//, "");

export const wrapNewStateForDispatching = <S>(s: S) => (typeof s === "function" ? () => s : s);

export const transformFilterPatterns = (patterns: (string | RegExp)[]): RegExp[] =>
  patterns.map((pattern) => (typeof pattern === "string" ? safeRegExp(pattern, "i") : pattern)).filter(isNotFalsy);

export const getPatternsMatcher = (patterns: (string | RegExp)[]) => (str: string) =>
  transformFilterPatterns(patterns).some((pattern) => str.match(pattern));

export const getPatternsFileNameMatcher = (patterns: (string | RegExp)[]) => getPatternsMatcher(patterns);

export const isNotFalse = <T>(t: false | T): t is T => t !== false;
export const isNotFalsy = <T>(t: false | undefined | null | T): t is T => t !== false && t !== undefined && t !== null;

export const getFilterMatchers = (filter: MetaFilter) =>
  [filter.excludes, filter.includes].map((patterns) => [
    getPatternsMatcher(patterns),
    getPatternsFileNameMatcher(patterns),
  ]);

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

export const carry = <T, R>(t: T, f: (t: T) => R): R => f(t);

export const clamp = (value: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) =>
  Math.max(min, Math.min(value, max));

export const compareStrings = (a: string, b: string, order: Order = "asc") =>
  (order === "asc" ? 1 : -1) * (a === b ? 0 : a > b ? 1 : -1);
