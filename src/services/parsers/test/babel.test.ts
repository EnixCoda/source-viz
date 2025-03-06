// test parsing './import-and-requires' with babel
import { it, expect } from "vitest";
import * as babelParser from "../babel";
import * as path from "node:path";
import { readFile } from "node:fs/promises";

it("should parse import and require statements", async () => {
  const fileContent = await readFile(path.join(__dirname, "import-and-require.js"), "utf-8");
  const parse = await babelParser.prepare();
  const ast = parse(fileContent);
  expect(ast).toMatchSnapshot();
});
