import minimatch from "minimatch";
import * as React from "react";
import { deps, entriesToPreparedData, FSLike } from ".";
import { defaultExcludes, defaultIncludes } from "../components/Scan";
import { resolvePath } from "../utils/general";
import { prepareGraphData } from "../utils/getData";
import * as babelParser from "./parsers/babel";

export async function prepareData(
  files: File[],
  setProgress: React.Dispatch<React.SetStateAction<number>>,
  getFilePath: (file: File) => string
) {
  const includes: string[] = defaultIncludes;
  const excludes: string[] = defaultExcludes;

  const createMatcher = (patterns: string[]) => (item: string) => patterns.some((pattern) => minimatch(item, pattern));
  const isIncluded = createMatcher(includes);
  const isExcluded = createMatcher(excludes);
  const pathToFileMap: Map<string, File> = new Map();
  for (const file of files) {
    const relativePath = getFilePath(file);
    if (isExcluded(relativePath)) continue;
    pathToFileMap.set(relativePath, file);
  }

  const fsLike: FSLike = {
    resolvePath,
    readFile: (relativePath) => {
      const file = pathToFileMap.get(relativePath);
      if (!file) throw new Error(`No file found for "${relativePath}"`);
      return file.text();
    },
  };

  const parse = await babelParser.prepare();
  const records = await deps(Array.from(pathToFileMap.keys()), parse, fsLike, isIncluded, true, setProgress);

  const preparedData = prepareGraphData(entriesToPreparedData(records));

  return preparedData;
}
