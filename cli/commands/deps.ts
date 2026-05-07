import { Command } from "commander";
import { scan } from "../scanner";

function bfsReachable(start: string, adjMap: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of adjMap.get(node) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  visited.delete(start);
  return visited;
}

export function depsCmd(): Command {
  const cmd = new Command("deps")
    .description("Show dependencies or dependents of a file")
    .argument("<dir>", "Root directory to scan")
    .argument("<file>", "File path relative to <dir>")
    .option("--dependents", "Show files that import <file> instead")
    .option("--transitive", "Include transitive dependencies")
    .option("--include <patterns...>", "File include regex patterns")
    .option("--exclude <patterns...>", "File exclude regex patterns")
    .option("--silent", "Suppress warnings")
    .option("--json", "Output as JSON array")
    .action(
      async (
        dir: string,
        file: string,
        opts: { dependents?: boolean; transitive?: boolean; include?: string[]; exclude?: string[]; silent?: boolean; json?: boolean },
      ) => {
        const { depMap, dependantMap } = await scan(dir, {
          include: opts.include,
          exclude: opts.exclude,
          silent: opts.silent,
        });

        const adjMap = opts.dependents ? dependantMap : depMap;
        const results = opts.transitive
          ? bfsReachable(file, adjMap)
          : new Set(adjMap.get(file) ?? []);

        if (results.size === 0) {
          process.stderr.write(`No ${opts.dependents ? "dependents" : "dependencies"} found for: ${file}\n`);
          return;
        }

        const sorted = [...results].sort();
        if (opts.json) {
          process.stdout.write(JSON.stringify(sorted, null, 2) + "\n");
        } else {
          for (const dep of sorted) {
            process.stdout.write(dep + "\n");
          }
        }
      },
    );

  return cmd;
}
