/// <reference types="node" />
import { it, expect } from "vitest";
import * as oxcParser from "../oxc";
import * as path from "node:path";
import { readFile } from "node:fs/promises";

it("should parse import and require statements", async () => {
  const fileContent = await readFile(path.join(path.dirname(new URL(import.meta.url).pathname), "import-and-require.js"), "utf-8");
  const parse = await oxcParser.prepare();
  const ast = parse(fileContent);
  expect(ast).toMatchSnapshot();
});
