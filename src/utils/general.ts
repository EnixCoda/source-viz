import minimatch from "minimatch";
import { MetaFilter } from "../services";

export function safeRegExp(raw: string, flags: string = "") {
  try {
    return raw ? new RegExp(raw, flags) : null;
  } catch (error) {
    return null;
  }
}

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
