// test parsing './import-and-requires' with babel
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as babelParser from "../babel";

describe("babel", () => {
  it("should parse import and require statements", async () => {
    const fileContent = await fs.readFile(path.join(__dirname, "import-and-require.js"), "utf-8");
    const parse = await babelParser.prepare();
    const ast = parse(fileContent);
    expect(ast).toMatchSnapshot();
  });
});
