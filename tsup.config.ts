import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["cli/index.ts"],
  outDir: "dist-cli",
  format: "cjs",
  splitting: false,
  bundle: true,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: [
    "node:fs",
    "node:fs/promises",
    "node:path",
    "node:url",
    "node:child_process",
    "fs",
    "fs/promises",
    "path",
    "url",
    "child_process",
    "events",
    "stream",
    "string_decoder",
    // Babel packages use dynamic require internally — keep external
    "@babel/parser",
    "@babel/traverse",
  ],
  noExternal: [/.*/],
});
