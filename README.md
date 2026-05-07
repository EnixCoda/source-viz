# source-viz

Visualize JavaScript/TypeScript import dependency graphs — in the browser or from the command line.

> **Screenshot / demo GIF** — add one here once deployed.

## Features

- 📂 **Browser UI** — scan a local project folder directly in Chrome/Edge (no upload, fully local)
- 🔍 **Dependency graph** — interactive D3 force-directed visualization with zoom, drag, and selection
- 🔄 **Cycle detection** — highlights circular dependencies so you can break them
- 🗂 **tsconfig alias support** — resolves `@/...` and other path aliases from `tsconfig.json`
- 💻 **CLI** — `npx source-viz` for scripting, CI integration, and quick terminal analysis
- 📤 **Export / restore** — save the scan result to JSON and resume without rescanning
- 🎯 **Filter** — include/exclude patterns (regex) to narrow scan scope

## Live Demo

> Coming soon — or run `npm run dev` locally and click **Try Demo**.

## Web UI

The web UI works in **Chrome or Edge** (requires the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)).

```
# Run locally
git clone https://github.com/EnixCoda/source-viz.git
cd source-viz
npm install
npm run dev
```

Open the shown URL, click **Scan local project**, and pick your project root folder.

## CLI

### Install

```bash
npm install -g source-viz
# or run without installing:
npx source-viz
```

> Requires Node.js ≥ 18.

### Commands

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

### Options (all commands)

| Flag | Description |
|------|-------------|
| `--include <patterns...>` | Regex patterns for files to include |
| `--exclude <patterns...>` | Regex patterns for files/paths to exclude |
| `--silent` | Suppress warnings |
| `--json` | Output as JSON array (`cycles`, `deps`) |

## Development

```bash
git clone https://github.com/EnixCoda/source-viz.git
cd source-viz
npm install

npm run dev          # start dev server
npm test             # run tests
npm run lint         # lint
npm run build        # production build
npm run build:cli    # bundle CLI to dist-cli/
```

To regenerate the demo data:
```bash
npm run generate-demo
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © EnixCoda
