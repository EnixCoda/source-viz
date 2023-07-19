import { MetaFilter } from "../services";
import { isNotFalsy, safeRegExp } from "./general";

export const transformFilterPatterns = (patterns: (string | RegExp)[]): RegExp[] =>
  patterns.map((pattern) => (typeof pattern === "string" ? safeRegExp(pattern, "i") : pattern)).filter(isNotFalsy);

export const getPatternsMatcher = (patterns: (string | RegExp)[]) => (str: string) =>
  transformFilterPatterns(patterns).some((pattern) => str.match(pattern));

export const getPatternsFileNameMatcher = (patterns: (string | RegExp)[]) => getPatternsMatcher(patterns);

export const getFilterMatchers = (filter: MetaFilter) =>
  [filter.excludes, filter.includes].map((patterns) => [
    getPatternsMatcher(patterns),
    getPatternsFileNameMatcher(patterns),
  ]);
