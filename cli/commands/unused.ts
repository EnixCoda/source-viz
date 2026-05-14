import { Command } from "commander";
import * as nodefs from "node:fs/promises";
import * as nodepath from "node:path";
import { scan } from "../scanner";
import { findUnusedDeps, getDeclaredDeps } from "../../src/services/unusedDeps";

export function unusedCmd(): Command {
  return new Command("unused")
    .description("Find declared dependencies not imported by any source file")
    .argument("<dir>", "Root directory to scan")
    .option("--dev", "Also check devDependencies")
    .option("--include <patterns...>", "File include regex patterns")
    .option("--exclude <patterns...>", "File exclude regex patterns")
    .option("--silent", "Suppress warnings")
    .option("--json", "Output as JSON array")
    .option("--parser <parser>", "Parser backend: oxc (default) or babel", "oxc")
    .action(async (dir: string, opts: {
      dev?: boolean;
      include?: string[];
      exclude?: string[];
      silent?: boolean;
      json?: boolean;
      parser?: string;
    }) => {
      const rootDir = nodepath.resolve(dir);

      // Read package.json
      let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      try {
        const content = await nodefs.readFile(nodepath.join(rootDir, "package.json"), "utf-8");
        packageJson = JSON.parse(content);
      } catch {
        process.stderr.write(`Error: No package.json found in ${rootDir}\n`);
        process.exit(1);
      }

      const declaredDeps = getDeclaredDeps(packageJson, { includeDevDependencies: opts.dev });
      if (declaredDeps.length === 0) {
        process.stderr.write("No dependencies declared in package.json.\n");
        return;
      }

      const { entries } = await scan(dir, {
        include: opts.include,
        exclude: opts.exclude,
        silent: opts.silent,
        parser: opts.parser as "oxc" | "babel",
      });

      const unused = findUnusedDeps(entries, declaredDeps);

      if (unused.length === 0) {
        process.stderr.write("All declared dependencies are used.\n");
        return;
      }

      if (opts.json) {
        process.stdout.write(JSON.stringify(unused, null, 2) + "\n");
      } else {
        process.stderr.write(`Found ${unused.length} unused dependenc${unused.length === 1 ? "y" : "ies"}:\n\n`);
        for (const pkg of unused) {
          process.stdout.write(`  ${pkg}\n`);
        }
        process.stdout.write("\n");
      }
    });
}
