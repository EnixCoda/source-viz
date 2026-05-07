import { Command } from "commander";
import { scan } from "../scanner";

function findCycles(depMap: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const allCycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (onStack.has(node)) {
      const start = path.indexOf(node);
      allCycles.push(path.slice(start));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    onStack.add(node);
    path.push(node);

    for (const dep of depMap.get(node) ?? []) {
      dfs(dep, [...path]);
    }

    onStack.delete(node);
  }

  for (const node of depMap.keys()) {
    if (!visited.has(node)) dfs(node, []);
  }

  // Deduplicate: normalize each cycle to its lexicographic minimum rotation
  const seen = new Set<string>();
  return allCycles.filter((cycle) => {
    const min = cycle.reduce((a, b) => (a < b ? a : b));
    const i = cycle.indexOf(min);
    const normalized = [...cycle.slice(i), ...cycle.slice(0, i)].join("|");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function cyclesCmd(): Command {
  return new Command("cycles")
    .description("Find all circular dependencies in a directory")
    .argument("<dir>", "Root directory to scan")
    .option("--include <patterns...>", "File include regex patterns")
    .option("--exclude <patterns...>", "File exclude regex patterns")
    .option("--silent", "Suppress warnings")
    .option("--json", "Output as JSON array")
    .action(async (dir: string, opts: { include?: string[]; exclude?: string[]; silent?: boolean; json?: boolean }) => {
      const { depMap } = await scan(dir, {
        include: opts.include,
        exclude: opts.exclude,
        silent: opts.silent,
      });

      const cycles = findCycles(depMap);

      if (cycles.length === 0) {
        process.stderr.write("No circular dependencies found.\n");
        return;
      }

      if (opts.json) {
        process.stdout.write(JSON.stringify(cycles, null, 2) + "\n");
      } else {
        process.stderr.write(`Found ${cycles.length} circular dependenc${cycles.length === 1 ? "y" : "ies"}:\n\n`);
        for (let i = 0; i < cycles.length; i++) {
          const cycle = cycles[i];
          process.stdout.write(`Cycle ${i + 1}:\n`);
          for (const node of [...cycle, cycle[0]]) {
            process.stdout.write(`  ${node}\n`);
          }
          process.stdout.write("\n");
        }
      }
    });
}
