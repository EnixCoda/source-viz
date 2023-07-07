// test parsing './import-and-requires' with babel
import fs from "fs/promises";
import path from "path";
import * as babelParser from "../babel";

describe("babel", () => {
  it("should parse import and require statements", async () => {
    const fileContent = await fs.readFile(path.join(__dirname, "import-and-require.js"), "utf-8");
    const parse = await babelParser.prepare();
    const ast = parse(fileContent);
    expect(ast).toMatchSnapshot();
  });
});
