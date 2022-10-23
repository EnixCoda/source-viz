import minimatch from "minimatch";
import * as React from "react";
import { deps, entriesToPreparedData, FSLike } from ".";
import { defaultExcludes, defaultIncludes } from "../components/Scan";
import { prepareGraphData } from "../utils/getData";
import * as babelParser from "./parsers/babel";

export async function prepareData(fileList: FileList, setProgress: React.Dispatch<React.SetStateAction<number>>) {
  const includes: string[] = defaultIncludes;
  const excludes: string[] = defaultExcludes;

  const createMatcher = (patterns: string[]) => (item: string) => patterns.some((pattern) => minimatch(item, pattern));
  const isIncluded = createMatcher(includes);
  const isExcluded = createMatcher(excludes);
  const files: Map<string, File> = new Map();
  for (const file of fileList) {
    const relativePath = file.webkitRelativePath;
    if (isExcluded(relativePath)) continue;
    files.set(relativePath, file);
  }

  const fsLike: FSLike = {
    resolvePath: (...ps) => new URL(ps.join("/").replace(/\/+/g, "/"), "http://localhost").pathname.replace(/^\//, ""),
    readFile: (relativePath) => {
      const file = files.get(relativePath);
      if (!file) throw new Error(`No file found for "${relativePath}"`);
      return file.text();
    },
  };

  const records = await deps(Array.from(files.keys()), babelParser.parse, fsLike, isIncluded, true, setProgress);

  const preparedData = prepareGraphData(entriesToPreparedData(records));

  return preparedData;
}
