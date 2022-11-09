export async function prepare() {
  const babelParser = await import("@babel/parser");
  const { default: traverse } = await import("@babel/traverse");
  return function parse(source: string) {
    const ast = babelParser.parse(source, {
      sourceType: "module",
      attachComment: false,
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "objectRestSpread",
        "optionalChaining",
        "nullishCoalescingOperator",
        "dynamicImport",
      ],
    });
    const dependencies: [string, boolean][] = [];
    for (const node of ast.program.body) {
      if (node.type === "ImportDeclaration") {
        const { source } = node;
        const { value: dependency } = source;
        dependencies.push([dependency, false]);
      }
    }
    // TODO: find `import()` statements
    const shouldScanDynamicImport = source.includes("import(");
    if (shouldScanDynamicImport) {
      // extract `import()` statements
      traverse(ast, {
        Import: (nodePath) => {
          const { parent } = nodePath;
          if (parent.type === "CallExpression") {
            const importTargetNode = parent.arguments[0];
            if (importTargetNode.type === "StringLiteral") {
              const dependency = importTargetNode.value;
              dependencies.push([dependency, true]);
            } else if (importTargetNode.type === "TemplateLiteral") {
              for (const node of importTargetNode.quasis) {
                const dependency = node.value.cooked || node.value.raw;
                dependencies.push([dependency, true]);
              }
            } else {
              throw new Error(`${importTargetNode.type} is not a string`);
            }
          } else {
            throw new Error(`Unexpected parent type "${parent.type}"`);
          }
        },
      });
      // parse extracted statements
      // extract dependencies
    }
    return dependencies;
  };
}
