import { Command } from "commander";
import { scan } from "../scanner";
import { entrySerializers } from "../../src/services/serializers";
import * as nodefs from "node:fs/promises";

export function scanCmd(): Command {
  return new Command("scan")
    .description("Scan a directory and output the dependency map")
    .argument("<dir>", "Root directory to scan")
    .option("-f, --format <format>", "Output format: json or csv", "json")
    .option("-o, --out <file>", "Write output to file instead of stdout")
    .option("--include <patterns...>", "File include regex patterns")
    .option("--exclude <patterns...>", "File exclude regex patterns")
    .option("--silent", "Suppress warnings")
    .action(async (dir: string, opts: { format: string; out?: string; include?: string[]; exclude?: string[]; silent?: boolean }) => {
      const { entries } = await scan(dir, {
        include: opts.include,
        exclude: opts.exclude,
        silent: opts.silent,
      });

      const format = opts.format as "json" | "csv";
      const serializer = entrySerializers[format];
      if (!serializer) {
        process.stderr.write(`Unknown format: ${opts.format}. Use json or csv.\n`);
        process.exit(1);
      }

      const output = serializer(entries);

      if (opts.out) {
        await nodefs.writeFile(opts.out, output, "utf-8");
        process.stderr.write(`Written to ${opts.out}\n`);
      } else {
        process.stdout.write(output + "\n");
      }
    });
}
