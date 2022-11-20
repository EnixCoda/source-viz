import * as React from "react";
import { deps, FSLike, MetaFilter } from ".";
import { getFilterMatchers, resolvePath } from "../utils/general";
import * as babelParser from "./parsers/babel";

export async function prepareData(
  files: File[],
  onProgress: React.Dispatch<React.SetStateAction<[file: string, count: number]>>,
  onError: (file: string, error: unknown) => void,
  getFilePath: (file: File) => string,
  filter: MetaFilter
) {
  const [, [isIncluded] = []] = filter ? getFilterMatchers(filter) : [];

  const pathToFileMap: Map<string, File> = new Map();
  for (const file of files) {
    const relativePath = getFilePath(file);
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
  const entries = await deps(Array.from(pathToFileMap.keys()), parse, fsLike, isIncluded, false, {
    onError,
    reportProgress(file, count) {
      onProgress([file, count]);
    },
  });

  return entries;
}
