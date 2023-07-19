import { join } from "path-browserify";

export const resolvePath = (...paths: string[]) => {
  const path = join(...paths);
  if (path.match(/\.\./)) throw new Error(`Path "${path}" is lower than root`);
  return path;
};
// Relative:
//    ./
//    ../
// Absolute:
//    path
//    path/to/file
//    /path/to/file
// do not use `path.isAbsolute` here, because of usages like `lib/path`

export const isRelativePath = (path: string) => path.startsWith(".");
