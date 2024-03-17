import { Dependency, DependencyEntry } from "../services/serializers";
import { Order } from "../types";
import { compareStrings } from "./general";
import { w } from "./w";

const deduplicateDependencyEntries = (entries: DependencyEntry[]): DependencyEntry[] =>
  entries.some((cur, _, arr) => cur[0] === arr[_ - 1]?.[0])
    ? entries.reduce(
        (acc, cur) => {
          if (acc.at(-1)?.[0] === cur[0]) acc.at(-1)?.[1].push(...cur[1]);
          else acc.push(cur);
          return acc;
        },
        [] as typeof entries,
      )
    : entries;

const deduplicateDependencies = (dependencies: Dependency[]): Dependency[] =>
  dependencies.some((cur, _, arr) => cur[0] === arr[_ - 1]?.[0] && cur[1] === arr[_ - 1]?.[1])
    ? dependencies.reduce(
        (acc, cur) => {
          if (acc.at(-1)?.[0] !== cur[0] || acc.at(-1)?.[1] !== cur[1]) acc.push(cur);
          return acc;
        },
        [] as typeof dependencies,
      )
    : dependencies;

export function getOrganizedEntries(entries: DependencyEntry[], order?: Order): DependencyEntry[] {
  return w(entries.map((_) => _.slice() as typeof _).sort(([a], [b]) => compareStrings(a, b, order)))(
    deduplicateDependencyEntries,
  ).map(
    ([file, dependencies]) =>
      [
        file,
        w(
          dependencies.sort(
            ([a, isAsyncA], [b, isAsyncB]) =>
              compareStrings(a, b, order) && (isAsyncA === isAsyncB ? 0 : isAsyncA ? 1 : -1),
          ),
        )(deduplicateDependencies),
      ] satisfies (typeof entries)[number],
  );
}
