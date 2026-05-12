/**
 * OXC-based parser — faster alternative to Babel for extracting import/require dependencies.
 *
 * Uses `oxc-parser` with its WASM binding (`@oxc-parser/binding-wasm32-wasi`) so it works
 * in both Node.js and browser environments.  The `module` property on the parse result gives
 * us static imports and dynamic `import()` expressions for free; `require()` calls need a
 * lightweight recursive AST walk.
 */

type AnyNode = Record<string, any>;

/** Extract the string value from a Literal or plain TemplateLiteral node. */
function extractStringValue(node: AnyNode): string | undefined {
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === "StringLiteral" && typeof node.value === "string") {
    return node.value;
  }
  if (
    node.type === "TemplateLiteral" &&
    node.expressions?.length === 0 &&
    node.quasis?.length === 1
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return undefined;
}

/** Recursively walk an AST node collecting `require('...')` and `import('...')` calls. */
function collectCallDeps(node: AnyNode, requires: string[], dynamicImports: string[]): void {
  if (!node || typeof node !== "object") return;

  // require('...')
  if (
    node.type === "CallExpression" &&
    node.callee?.type === "Identifier" &&
    node.callee.name === "require" &&
    node.arguments?.length === 1
  ) {
    const value = extractStringValue(node.arguments[0]);
    if (value !== undefined) {
      requires.push(value);
    }
  }

  // import('...')
  if (node.type === "ImportExpression" && node.source) {
    const value = extractStringValue(node.source);
    if (value !== undefined) {
      dynamicImports.push(value);
    }
  }

  // Walk children (arrays and objects)
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "type") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && item.type) {
          collectCallDeps(item, requires, dynamicImports);
        }
      }
    } else if (child && typeof child === "object" && child.type) {
      collectCallDeps(child, requires, dynamicImports);
    }
  }
}

export async function prepare() {
  // Dynamic import so the WASM binary is only fetched when this parser is selected.
  // Vite resolves the `browser` field of @oxc-parser/binding-wasm32-wasi automatically.
  // @ts-expect-error -- oxc-parser doesn't export wasm.js from its type definitions
  const oxc = (await import("oxc-parser/src-js/wasm.js")) as typeof import("oxc-parser");

  return function parse(source: string): [string, boolean][] {
    const result = oxc.parseSync("input.tsx", source, {
      sourceType: "unambiguous",
    });

    const dependencies: [string, boolean][] = [];

    // 1. Static imports — `import ... from '...'` and `import '...'`
    for (const imp of result.module.staticImports) {
      // Skip type-only imports (`import type { X } from '...'`)
      const allType = imp.entries.length > 0 && imp.entries.every((e: { isType: boolean }) => e.isType);
      if (allType) continue;
      dependencies.push([imp.moduleRequest.value, false]);
    }

    // 2. Dynamic imports `import('...')` and require('...') — extracted from AST walk
    //    to properly filter out non-string arguments (e.g. `import('foo' + bar)`)
    const requirePaths: string[] = [];
    const dynamicImportPaths: string[] = [];
    collectCallDeps(result.program as AnyNode, requirePaths, dynamicImportPaths);

    for (const path of dynamicImportPaths) {
      dependencies.push([path, true]);
    }
    for (const req of requirePaths) {
      dependencies.push([req, false]);
    }

    return dependencies;
  };
}
