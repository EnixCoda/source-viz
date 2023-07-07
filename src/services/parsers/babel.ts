import zod from "zod";

const stringLiteral = zod.object({
  type: zod.literal("StringLiteral"),
  value: zod.string(),
});
const plainTemplateLiteral = zod.object({
  type: zod.literal("TemplateLiteral"),
  expressions: zod.array(zod.any()).length(0),
  quasis: zod
    .array(
      zod.object({
        type: zod.literal("TemplateElement"),
        value: zod.object({
          raw: zod.string(),
          cooked: zod.string(),
        }),
        tail: zod.boolean(),
      }),
    )
    .length(1),
});

const generalStringLiteral = zod.union([stringLiteral, plainTemplateLiteral]);

const requireString = zod.object({
  type: zod.literal("CallExpression"),
  callee: zod.object({
    type: zod.literal("Identifier"),
    name: zod.literal("require"),
  }),
  arguments: zod.array(generalStringLiteral).length(1),
});

const importStringLiteral = zod.object({
  type: zod.literal("ImportDeclaration"),
  importKind: zod.literal("value"),
  source: stringLiteral,
});

const asyncImportExpression = zod.object({
  type: zod.literal("CallExpression"),
  callee: zod.object({
    type: zod.literal("Import"),
  }),
  arguments: zod.array(generalStringLiteral).length(1),
});

const resolveStringLiteralValue = (importTargetNode: zod.infer<typeof stringLiteral | typeof plainTemplateLiteral>) => {
  if (importTargetNode.type === "StringLiteral") {
    return importTargetNode.value;
  } else if (importTargetNode.type === "TemplateLiteral") {
    for (const node of importTargetNode.quasis) {
      return node.value.cooked || node.value.raw;
    }
  }
};

export async function prepare() {
  const babelParser = await import("@babel/parser");
  const { default: traverse } = await import("@babel/traverse");
  return function parse(source: string) {
    const ast = babelParser.parse(source, {
      sourceType: "module",
      attachComment: false,
      plugins: [
        "asyncDoExpressions",
        "asyncGenerators",
        "bigInt",
        "classPrivateMethods",
        "classPrivateProperties",
        "classProperties",
        "classStaticBlock", // Enabled by default
        "decimal",
        // "decorators-legacy", // conflict with "decorators"
        "decoratorAutoAccessors",
        "destructuringPrivate",
        "doExpressions",
        "dynamicImport",
        "explicitResourceManagement",
        "exportDefaultFrom",
        // "flow", // conflict with TypeScript
        // "flowComments",
        "functionBind",
        "functionSent",
        "importMeta",
        "jsx",
        "logicalAssignment",
        "importAssertions",
        "importReflection",
        "moduleBlocks",
        "moduleStringNames",
        "nullishCoalescingOperator",
        "numericSeparator",
        "objectRestSpread",
        "optionalCatchBinding",
        "optionalChaining",
        "partialApplication",
        "placeholders",
        "privateIn", // Enabled by default
        "regexpUnicodeSets",
        "throwExpressions",
        "topLevelAwait",
        // "v8intrinsic", // conflict with "placeholders"

        "decorators",

        // should not disable, otherwise traverse would encounter problem
        // "estree", // reverts deviations from the ESTree spec

        // Deprecated
        "exportNamespaceFrom",
        // "moduleAttributes"
        // "pipelineOperator",
        "recordAndTuple",
        // "flow",
        "typescript",
      ],
    });
    const dependencies: [string, boolean][] = [];

    traverse(ast, {
      CallExpression: ({ node }) => {
        const parsed = requireString.safeParse(node);
        if (!parsed.success) return;

        const [importTargetNode] = parsed.data.arguments;
        const dependency = resolveStringLiteralValue(importTargetNode);
        if (dependency) dependencies.push([dependency, false]);
      },
      ImportDeclaration: ({ node }) => {
        const parsed = importStringLiteral.safeParse(node);
        if (!parsed.success) return;

        const { value } = parsed.data.source;
        dependencies.push([value, false]);
      },
      Import: ({ parent }) => {
        const parsed = asyncImportExpression.safeParse(parent);
        if (!parsed.success) return;

        const [importTargetNode] = parsed.data.arguments;
        const dependency = resolveStringLiteralValue(importTargetNode);
        if (dependency) dependencies.push([dependency, true]);
      },
    });
    return dependencies;
  };
}
