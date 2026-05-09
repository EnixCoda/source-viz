import { describe, it, expect } from "vitest";
// @ts-expect-error -- oxc-parser doesn't export wasm.js from its type definitions
import * as oxc from "oxc-parser/src-js/wasm.js";
import { analyzeFile, memberKey, type Parser } from "../parseSymbols";

const parse: Parser = (filename, source) => {
  const r = (oxc as typeof import("oxc-parser")).parseSync(filename, source, { sourceType: "module" });
  return { program: r.program as any, module: r.module as any };
};

const a = (src: string) => analyzeFile("input.tsx", src, parse);

describe("parseSymbols", () => {
  it("captures named imports", () => {
    const r = a(`import { foo, bar as b } from './x';`);
    expect(r.imports).toEqual([
      { kind: "named", localName: "foo", importedName: "foo", source: "./x" },
      { kind: "named", localName: "b", importedName: "bar", source: "./x" },
    ]);
  });

  it("captures namespace imports", () => {
    const r = a(`import * as N from './x';`);
    expect(r.imports).toEqual([{ kind: "namespace", localName: "N", source: "./x" }]);
  });

  it("skips type-only imports", () => {
    const r = a(`import type { T } from './x'; import { type U, v } from './y';`);
    expect(r.imports).toEqual([{ kind: "named", localName: "v", importedName: "v", source: "./y" }]);
  });

  it("skips default imports (v1)", () => {
    const r = a(`import D from './x';`);
    expect(r.imports).toEqual([]);
  });

  it("captures named re-exports with alias", () => {
    const r = a(`export { foo as bar } from './x';`);
    expect(r.reExports).toEqual([
      { kind: "named", importedName: "foo", exportedAs: "bar", source: "./x" },
    ]);
  });

  it("captures export *", () => {
    const r = a(`export * from './x';`);
    expect(r.reExports).toEqual([{ kind: "all", source: "./x" }]);
  });

  it("captures export * as N", () => {
    const r = a(`export * as N from './x';`);
    expect(r.reExports).toEqual([{ kind: "namespace", exportedAs: "N", source: "./x" }]);
  });

  it("captures local exports + decl refs", () => {
    const r = a(`
      import { foo } from './x';
      export const wrap = (x) => foo(x) + 1;
    `);
    expect(r.exports.map((e) => e.name)).toEqual(["wrap"]);
    expect(r.decls.length).toBe(1);
    expect(r.decls[0].name).toBe("wrap");
    expect(r.decls[0].isExported).toBe(true);
    expect(r.decls[0].refs.has("foo")).toBe(true);
  });

  it("captures function decl refs", () => {
    const r = a(`
      import { foo } from './x';
      export function wrap(y) { return foo(y); }
    `);
    expect(r.exports.map((e) => e.name)).toEqual(["wrap"]);
    expect(r.decls[0].refs.has("foo")).toBe(true);
  });

  it("captures namespace member access", () => {
    const r = a(`
      import * as N from './x';
      export const wrap = () => N.foo();
    `);
    expect(r.decls[0].memberRefs.has(memberKey("N", "foo"))).toBe(true);
  });

  it("respects shadowing (parameter)", () => {
    const r = a(`
      import { foo } from './x';
      export const wrap = (foo) => foo();
    `);
    expect(r.decls[0].refs.has("foo")).toBe(false);
  });

  it("captures bare export { x }", () => {
    const r = a(`
      const helper = 1;
      export { helper };
    `);
    expect(r.exports.map((e) => e.name)).toEqual(["helper"]);
    expect(r.exports[0].declIndex).toBe(0);
    expect(r.decls[0].isExported).toBe(true);
  });

  it("captures bare export { x as y }", () => {
    const r = a(`
      const helper = 1;
      export { helper as utility };
    `);
    expect(r.exports[0]).toEqual({ name: "utility", declIndex: 0, localName: "helper" });
  });

  it("captures JSX component refs", () => {
    const r = a(`
      import { Button } from './ui';
      export const Page = () => <Button />;
    `);
    expect(r.decls[0].refs.has("Button")).toBe(true);
  });

  it("captures JSX namespace member", () => {
    const r = a(`
      import * as Ui from './ui';
      export const Page = () => <Ui.Button />;
    `);
    expect(r.decls[0].memberRefs.has(memberKey("Ui", "Button"))).toBe(true);
  });
});
