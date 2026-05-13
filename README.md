# source-viz

[![CI](https://github.com/EnixCoda/source-viz/actions/workflows/ci.yml/badge.svg)](https://github.com/EnixCoda/source-viz/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/source-viz)](https://www.npmjs.com/package/source-viz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Visualize JavaScript/TypeScript import dependency graphs — in the browser or from the command line.

## Web UI

Play now — https://srcviz.enix.one/

## Why?

Most dependency-analysis tools require complex config, only run in CI, or upload your code somewhere. source-viz doesn't:

- **Zero config** — point it at a directory and go. tsconfig path aliases are resolved automatically.
- **Interactive graph** — visualization with zoom, drag, and node selection.
- **Cycle detection** — circular dependencies are highlighted out of the box.
- **Dual interface** — explore visually in the browser, or script and automate with the CLI.
- **Fully local** — the browser reads your folder directly via the File System Access API. Nothing leaves your machine.

## CLI

```bash
npx source-viz
```

#### `scan <dir>` — output the full dependency map

```bash
npx source-viz scan src
npx source-viz scan src --out graph.json
npx source-viz scan src --format csv
npx source-viz scan src --exclude "**/*.test.ts" --exclude "node_modules"
```

#### `cycles <dir>` — find circular dependencies

```bash
npx source-viz cycles src
npx source-viz cycles src --json
```

Example output:
```
Found 2 circular dependencies:

Cycle 1:
  components/App.tsx
  components/Sidebar.tsx
  components/App.tsx
```

#### `deps <dir> <file>` — show dependencies of a file

```bash
# Direct dependencies
npx source-viz deps src components/App.tsx

# Transitive dependencies
npx source-viz deps src components/App.tsx --transitive

# Who imports this file?
npx source-viz deps src utils/helpers.ts --dependents

# Full reverse dependency tree
npx source-viz deps src utils/helpers.ts --dependents --transitive
```

#### Common options

| Flag | Description |
|------|-------------|
| `--include <patterns...>` | Regex patterns for files to include |
| `--exclude <patterns...>` | Regex patterns for files/paths to exclude |
| `--silent` | Suppress warnings |
| `--json` | Output as JSON array (`cycles`, `deps`) |

## Alternatives

| | **source-viz** | dependency-cruiser | madge | Skott |
|---|:---:|:---:|:---:|:---:|
| | | [↗](https://github.com/sverweij/dependency-cruiser) | [↗](https://github.com/pahen/madge) | [↗](https://github.com/antoine-coulon/skott) |
| Zero install | ✅ | ❌ | ❌ | ❌ |
| Web UI | ✅ | ❌ | ❌ | ✅ (CLI-launched) |
| Interactive graph | ✅ | ❌ | ❌ | ✅ |
| Zero config | ✅ | ❌ | ✅ | ✅ |
| Cycle detection | ✅ | ✅ | ✅ | ✅ |
| CLI | ✅ | ✅ | ✅ | ✅ |
| Custom rules / validation | ❌ | ✅ | ❌ | ❌ |
| Vue / Svelte / CSS support | ❌ | ✅ | partial | ❌ |
| Unused dep detection | ❌ | partial | ❌ | ✅ |
| SVG / PNG export | ❌ | ✅ | ✅ | ✅ |
| Programmatic API | ❌ | ✅ | ✅ | ✅ |

## License

[MIT](LICENSE) © EnixCoda
