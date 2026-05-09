/**
 * Single-file symbol analyzer for the on-demand usage investigator.
 *
 * Given a JS/TS source string, extracts:
 *  - imports         : named/aliased/namespace bindings the file pulls in
 *  - reExports       : `export { x } from 'mod'`, `export * from 'mod'`,
 *                      `export * as N from 'mod'`
 *  - exports         : locally declared exported names + a pointer into `decls`
 *  - decls           : every top-level binding (exported or not) with a Set of
 *                      identifier names *and* namespace-member accesses (N.foo)
 *                      referenced anywhere in its body.
 *
 * Default exports are intentionally skipped in v1 (no entries produced).
 *
 * Reference scanning is **cheap name-matching** — we collect raw identifier
 * names and let the `expand` engine intersect them with the file's known import
 * locals + sibling decl names. ~95% accurate; fails only on inner scopes that
 * shadow an imported name, which is rare in practice.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = Record<string, any>;

export type ImportBinding =
  | { kind: "named"; localName: string; importedName: string; source: string }
  | { kind: "namespace"; localName: string; source: string };

export type ReExport =
  /** export { x as y } from 'mod' */
  | { kind: "named"; importedName: string; exportedAs: string; source: string }
  /** export * as N from 'mod'  */
  | { kind: "namespace"; exportedAs: string; source: string }
  /** export * from 'mod' */
  | { kind: "all"; source: string };

export type ExportDecl = {
  name: string;
  /** Index into `decls[]`. -1 if no matching local decl was found. */
  declIndex: number;
  localName: string;
};

export type TopLevelDecl = {
  name: string;
  refs: Set<string>;
  /** Namespace member accesses: stored as `${nsLocal}\u0000${memberName}`. */
  memberRefs: Set<string>;
  isExported: boolean;
};

export type FileSymbols = {
  imports: ImportBinding[];
  reExports: ReExport[];
  exports: ExportDecl[];
  decls: TopLevelDecl[];
};

export const MEMBER_SEP = "\u0000";

export function memberKey(ns: string, member: string): string {
  return `${ns}${MEMBER_SEP}${member}`;
}

/* -------------------------------------------------------------------------- */
/*  Reference scanning                                                         */
/* -------------------------------------------------------------------------- */

function collectRefs(
  node: AnyNode | null | undefined,
  refs: Set<string>,
  memberRefs: Set<string>,
  localBindings: Set<string>,
): void {
  if (!node || typeof node !== "object") return;
  const type = node.type as string | undefined;
  if (!type) return;

  const snapshot: string[] = [];
  const addBinding = (name: string) => {
    if (!localBindings.has(name)) {
      snapshot.push(name);
      localBindings.add(name);
    }
  };

  switch (type) {
    case "Identifier": {
      const name = node.name as string;
      if (name && !localBindings.has(name)) refs.add(name);
      return;
    }
    case "MemberExpression": {
      const obj = node.object;
      const prop = node.property;
      const computed = node.computed === true;
      if (
        !computed &&
        obj &&
        obj.type === "Identifier" &&
        prop &&
        prop.type === "Identifier" &&
        !localBindings.has(obj.name)
      ) {
        memberRefs.add(memberKey(obj.name, prop.name));
        refs.add(obj.name);
      } else {
        collectRefs(obj, refs, memberRefs, localBindings);
        if (computed) collectRefs(prop, refs, memberRefs, localBindings);
      }
      return;
    }
    case "VariableDeclarator": {
      collectBindingNames(node.id, addBinding);
      collectRefs(node.init, refs, memberRefs, localBindings);
      break;
    }
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression": {
      if (node.id?.name) addBinding(node.id.name);
      for (const p of node.params || []) collectBindingNames(p, addBinding);
      for (const p of node.params || []) walkDefaults(p, refs, memberRefs, localBindings);
      collectRefs(node.body, refs, memberRefs, localBindings);
      for (const n of snapshot) localBindings.delete(n);
      return;
    }
    case "ClassDeclaration":
    case "ClassExpression": {
      if (node.id?.name) addBinding(node.id.name);
      collectRefs(node.superClass, refs, memberRefs, localBindings);
      collectRefs(node.body, refs, memberRefs, localBindings);
      for (const n of snapshot) localBindings.delete(n);
      return;
    }
    case "CatchClause": {
      collectBindingNames(node.param, addBinding);
      collectRefs(node.body, refs, memberRefs, localBindings);
      for (const n of snapshot) localBindings.delete(n);
      return;
    }
    case "Property": {
      if (node.computed === true) collectRefs(node.key, refs, memberRefs, localBindings);
      collectRefs(node.value, refs, memberRefs, localBindings);
      return;
    }
    case "MethodDefinition":
    case "PropertyDefinition": {
      if (node.computed === true) collectRefs(node.key, refs, memberRefs, localBindings);
      collectRefs(node.value, refs, memberRefs, localBindings);
      return;
    }
    case "JSXMemberExpression": {
      const obj = node.object;
      const prop = node.property;
      if (
        obj && obj.type === "JSXIdentifier" &&
        prop && prop.type === "JSXIdentifier" &&
        !localBindings.has(obj.name)
      ) {
        memberRefs.add(memberKey(obj.name, prop.name));
        refs.add(obj.name);
      } else {
        collectRefs(obj, refs, memberRefs, localBindings);
      }
      return;
    }
    case "JSXIdentifier": {
      const name = node.name as string;
      if (name && /^[A-Z]/.test(name) && !localBindings.has(name)) refs.add(name);
      return;
    }
    case "JSXOpeningElement":
    case "JSXClosingElement": {
      collectRefs(node.name, refs, memberRefs, localBindings);
      for (const a of node.attributes || []) collectRefs(a, refs, memberRefs, localBindings);
      return;
    }
    // type-only — skip
    case "TSTypeReference":
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
    case "TSTypeAnnotation":
    case "TSTypeParameter":
    case "TSTypeParameterDeclaration":
    case "TSTypeParameterInstantiation":
      return;
    default:
      break;
  }

  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end" ||
        key === "loc" || key === "range" || key === "raw") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object") collectRefs(item, refs, memberRefs, localBindings);
      }
    } else if (child && typeof child === "object") {
      collectRefs(child, refs, memberRefs, localBindings);
    }
  }

  for (const n of snapshot) localBindings.delete(n);
}

function walkDefaults(
  pattern: AnyNode | null | undefined,
  refs: Set<string>,
  memberRefs: Set<string>,
  localBindings: Set<string>,
) {
  if (!pattern || typeof pattern !== "object") return;
  if (pattern.type === "AssignmentPattern") {
    collectRefs(pattern.right, refs, memberRefs, localBindings);
    walkDefaults(pattern.left, refs, memberRefs, localBindings);
    return;
  }
  for (const key of Object.keys(pattern)) {
    const c = pattern[key];
    if (Array.isArray(c)) for (const x of c) walkDefaults(x, refs, memberRefs, localBindings);
    else if (c && typeof c === "object") walkDefaults(c, refs, memberRefs, localBindings);
  }
}

function collectBindingNames(pattern: AnyNode | null | undefined, sink: (name: string) => void): void {
  if (!pattern || typeof pattern !== "object") return;
  switch (pattern.type) {
    case "Identifier":
      if (pattern.name) sink(pattern.name);
      return;
    case "RestElement":
      collectBindingNames(pattern.argument, sink);
      return;
    case "AssignmentPattern":
      collectBindingNames(pattern.left, sink);
      return;
    case "ArrayPattern":
      for (const el of pattern.elements || []) collectBindingNames(el, sink);
      return;
    case "ObjectPattern":
      for (const prop of pattern.properties || []) {
        if (prop.type === "RestElement") collectBindingNames(prop.argument, sink);
        else collectBindingNames(prop.value, sink);
      }
      return;
  }
}

/* -------------------------------------------------------------------------- */
/*  Top-level analysis                                                         */
/* -------------------------------------------------------------------------- */

function analyzeDecl(node: AnyNode, isExported: boolean, sink: TopLevelDecl[]): void {
  switch (node.type) {
    case "VariableDeclaration": {
      for (const dec of node.declarations || []) {
        const names: string[] = [];
        collectBindingNames(dec.id, (n) => names.push(n));
        const refs = new Set<string>();
        const memberRefs = new Set<string>();
        const inner = new Set<string>(names);
        collectRefs(dec.init, refs, memberRefs, inner);
        for (const n of names) sink.push({ name: n, refs, memberRefs, isExported });
      }
      return;
    }
    case "FunctionDeclaration":
    case "ClassDeclaration": {
      const name = node.id?.name as string | undefined;
      if (!name) return;
      const refs = new Set<string>();
      const memberRefs = new Set<string>();
      const inner = new Set<string>([name]);
      if (node.type === "FunctionDeclaration") {
        for (const p of node.params || []) collectBindingNames(p, (n) => inner.add(n));
        for (const p of node.params || []) walkDefaults(p, refs, memberRefs, inner);
        collectRefs(node.body, refs, memberRefs, inner);
      } else {
        collectRefs(node.superClass, refs, memberRefs, inner);
        collectRefs(node.body, refs, memberRefs, inner);
      }
      sink.push({ name, refs, memberRefs, isExported });
      return;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

export type Parser = (filename: string, source: string) => { program: AnyNode; module: AnyNode };

export function analyzeFile(filename: string, source: string, parse: Parser): FileSymbols {
  const result = parse(filename, source);
  const program = result.program;
  const mod = result.module;

  const imports: ImportBinding[] = [];
  const reExports: ReExport[] = [];
  const exports: ExportDecl[] = [];
  const decls: TopLevelDecl[] = [];

  for (const imp of (mod?.staticImports as AnyNode[]) || []) {
    const src = imp.moduleRequest?.value as string;
    if (!src) continue;
    for (const entry of (imp.entries as AnyNode[]) || []) {
      if (entry.isType) continue;
      const localName = entry.localName?.value as string;
      if (!localName) continue;
      const kind = entry.importName?.kind as string;
      if (kind === "NamespaceObject") {
        imports.push({ kind: "namespace", localName, source: src });
      } else if (kind === "Default") {
        // v1: skip default
      } else {
        const importedName = (entry.importName?.name as string) || localName;
        imports.push({ kind: "named", localName, importedName, source: src });
      }
    }
  }

  for (const stmt of (program?.body as AnyNode[]) || []) {
    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
      analyzeDecl(stmt.declaration, true, decls);
    } else if (
      stmt.type === "VariableDeclaration" ||
      stmt.type === "FunctionDeclaration" ||
      stmt.type === "ClassDeclaration"
    ) {
      analyzeDecl(stmt, false, decls);
    }
    // ExportDefaultDeclaration / ExportAllDeclaration handled via staticExports
  }

  for (const exp of (mod?.staticExports as AnyNode[]) || []) {
    for (const entry of (exp.entries as AnyNode[]) || []) {
      if (entry.isType) continue;
      const moduleRequest = entry.moduleRequest?.value as string | undefined;
      const exportNameKind = entry.exportName?.kind as string;
      const exportName = entry.exportName?.name as string | null;
      const importNameKind = entry.importName?.kind as string;

      if (exportNameKind === "Default") continue;

      if (moduleRequest) {
        if (importNameKind === "AllButDefault") {
          reExports.push({ kind: "all", source: moduleRequest });
        } else if (importNameKind === "All" && exportName) {
          reExports.push({ kind: "namespace", exportedAs: exportName, source: moduleRequest });
        } else if (importNameKind === "Name" && exportName) {
          const importedName = (entry.importName?.name as string) || exportName;
          reExports.push({ kind: "named", importedName, exportedAs: exportName, source: moduleRequest });
        }
      } else if (exportName) {
        const localName = (entry.localName?.name as string) || exportName;
        const declIndex = decls.findIndex((d) => d.name === localName);
        if (declIndex !== -1) decls[declIndex].isExported = true;
        if (!exports.some((e) => e.name === exportName)) {
          exports.push({ name: exportName, declIndex, localName });
        }
      }
    }
  }

  for (let i = 0; i < decls.length; i++) {
    const d = decls[i];
    if (d.isExported && !exports.some((e) => e.name === d.name)) {
      exports.push({ name: d.name, declIndex: i, localName: d.name });
    }
  }

  return { imports, reExports, exports, decls };
}
