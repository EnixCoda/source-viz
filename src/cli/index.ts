#!/usr/bin/env node

import fs from "fs/promises";
import minimatch from "minimatch";
import path from "path";
import yargs from "yargs";
import { FSLike, getDependencyEntries } from "../services";
import { getFiles } from "../services/node";
import * as babelParser from "../services/parsers/babel";
import { getEntrySerializerByFileName } from "../services/serializers";

const defaultIncludes = ["*.jsx?", "*.tsx?"];
const defaultExcludes = [".git", ".cache", "node_modules", "**/node_modules/**", "**/build/**", "**/dist/**"];

async function main() {
  const {
    p: project,
    o: output,
    i: includes,
    x: excludes,
  } = await yargs
    .scriptName("source")
    .usage("$0 [args]")
    .option("p", {
      alias: "project",
      describe: "project root directory",
      default: ".",
    })
    .option("o", {
      alias: "output",
      describe: "output file path, e.g. records.csv, records.json",
      default: "records.json",
    })
    .option("i", {
      alias: "includes",
      describe: "include patterns",
      default: defaultIncludes,
      type: "array",
    })
    .option("x", {
      alias: "excludes",
      describe: "exclude patterns",
      default: defaultExcludes,
      type: "array",
    })
    .help().argv;

  const createMatcher = (patterns: string[]) => (item: string) => patterns.some((pattern) => minimatch(item, pattern));
  const isIncluded = createMatcher(includes);
  const isExcluded = createMatcher(excludes);
  const files = await getFiles(path.resolve(project), isExcluded);

  const fsLike: FSLike = {
    resolvePath: path.join,
    readFile: (p) => fs.readFile(path.resolve(p, project), "utf-8"),
  };
  const parser = await babelParser.prepare();
  const records = await getDependencyEntries(files, parser, fsLike, isIncluded);

  const serializer = getEntrySerializerByFileName(output);
  if (!serializer) throw new Error(`No serializer matched with the extension of file "${output}"`);

  await fs.writeFile(output, serializer(records), "utf-8");
  console.log(`Records saved to "${path.resolve(output)}"`);
}

main();
