import { isRelativePath, resolvePath } from "./path";

it("resolvePath", () => {
  expect(resolvePath("src", "utils")).toBe("src/utils");
  expect(resolvePath("src", "..", "utils")).toBe("utils");
});

it("throws when path is lower than root", () => {
  expect(() => resolvePath("src", "..")).not.toThrow();
  expect(() => resolvePath("src", "..", "..")).toThrow();
  expect(() => resolvePath("src/../../src/src")).toThrow();
});

it("resolve absolute path", () => {
  expect(isRelativePath("/")).toBe(false);
  expect(isRelativePath("/src")).toBe(false);
  expect(isRelativePath("src")).toBe(false);
  expect(isRelativePath("./src")).toBe(true);
  expect(isRelativePath("../src")).toBe(true);
});
