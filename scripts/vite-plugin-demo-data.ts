/**
 * Vite plugin that generates demo data by scanning source-viz's own source code.
 * Runs at server start and build start, writing the result to public/demo-data.json.
 */
import { execFileSync } from "child_process";
import path from "path";
import type { Plugin } from "vite";

export function demoDataPlugin(): Plugin {
  function generate() {
    const script = path.resolve(import.meta.dirname, "generate-demo-data.ts");
    try {
      execFileSync("npx", ["tsx", script], {
        cwd: path.resolve(import.meta.dirname, ".."),
        stdio: "inherit",
      });
    } catch {
      console.warn("[demo-data] Failed to generate demo data, continuing without it");
    }
  }

  return {
    name: "vite-plugin-demo-data",
    buildStart() {
      generate();
    },
  };
}
