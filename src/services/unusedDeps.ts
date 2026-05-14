import type { DependencyEntry, DependencyKind } from "./serializers";

/**
 * Given scan entries and a list of declared package names,
 * returns the subset that are never imported by any source file.
 */
export function findUnusedDeps(
  entries: DependencyEntry[],
  declaredPackages: string[],
): string[] {
  // Collect every external import specifier actually used.
  // Imports look like "react", "@chakra-ui/react", "lodash/merge", etc.
  // We normalize to the package name (first segment, or first two for scoped).
  const usedPackages = new Set<string>();
  for (const [, deps] of entries) {
    for (const [specifier, , kind] of deps) {
      if (kind !== ("external" as DependencyKind)) continue;
      usedPackages.add(packageName(specifier));
    }
  }

  return declaredPackages.filter((pkg) => !usedPackages.has(pkg)).sort();
}

/** Extract the npm package name from an import specifier. */
function packageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    // Scoped: "@scope/pkg" or "@scope/pkg/sub"
    const parts = specifier.split("/");
    return parts.slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

/** Extract dependency names from a parsed package.json object. */
export function getDeclaredDeps(
  packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
  options: { includeDevDependencies?: boolean } = {},
): string[] {
  const deps = Object.keys(packageJson.dependencies ?? {});
  if (options.includeDevDependencies) {
    deps.push(...Object.keys(packageJson.devDependencies ?? {}));
  }
  // @types/* packages are only consumed by the compiler, never imported at runtime
  return deps.filter((d) => !d.startsWith("@types/"));
}
