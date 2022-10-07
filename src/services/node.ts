import * as fs from "fs/promises";
import path from "path";

const resolveSymlink = false;

export async function getFiles(
  rootDir: string,
  isExcluded: (path: string) => boolean
) {
  const files: string[] = [];

  async function scan(relativePath: string) {
    if (isExcluded(relativePath)) return;

    const absolutePath = path.resolve(rootDir, relativePath);
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      const items = await fs.readdir(absolutePath);
      for (const item of items) await scan(path.join(relativePath, item));
    } else if (stats.isFile()) {
      files.push(relativePath);
    } else if (stats.isSymbolicLink()) {
      if (resolveSymlink) {
        // TODO
        console.info(`Skipped symbolic link "${relativePath}"`);
      }
    } else {
      console.error(`Unrecognized item type "${relativePath}"`);
    }
  }

  await scan(".");

  return files;
}
