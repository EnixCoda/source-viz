#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = resolve(__dirname, "../node_modules/.bin/tsx");
const entry = resolve(__dirname, "index.ts");

const result = spawnSync(tsx, [entry, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 0);
