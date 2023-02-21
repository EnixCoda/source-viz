import minimatch from "minimatch";
import { MetaFilter } from "../services";

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

export const resolvePath = (...ps: string[]): string =>
  new URL(ps.join("/").replace(/\/+/g, "/"), "http://localhost").pathname.replace(/^\//, "");

export const wrapNewStateForDispatching = <S>(s: S) => (typeof s === "function" ? () => s : s);

export const getPatternsMatcher = (patterns: string[]) => (str: string) =>
  patterns.some((pattern) => minimatch(str, pattern));

export const getPatternsFileNameMatcher = (patterns: string[]) =>
  getPatternsMatcher(patterns.map((pattern) => pattern.replace(/^\*\*\/|\/\*\*$/g, "")));

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
