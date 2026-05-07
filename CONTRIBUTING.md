# Contributing to source-viz

Thanks for your interest! Here's how to get started.

## Development setup

```bash
git clone https://github.com/EnixCoda/source-viz.git
cd source-viz
npm install
npm run dev     # starts the Vite dev server
```

## Running tests

```bash
npm test              # run all tests
npm test -- --watch   # watch mode
```

## Code style

- TypeScript + React. Formatting is handled by Prettier (config in `package.json`).
- Lint with `npm run lint` before submitting a PR.
- Prefer conventional commit messages: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`.

## Project structure

```
src/
  components/     React components (App, Viz, Scan, FileExplorer…)
  services/       Core parsing and dependency resolution logic
  lib/graph-viz/  Custom D3 force-graph renderer
  utils/          Shared utilities
  hooks/          Reusable React hooks
cli/
  index.ts        CLI entry point (Commander)
  scanner.ts      Shared scan logic (used by all commands)
  fs-node.ts      Node.js FSLike implementation
  commands/       scan / cycles / deps subcommands
  __tests__/      CLI unit tests
scripts/
  generate-demo-data.ts   Generates public/demo-data.json
```

## Submitting changes

1. Fork the repo and create a feature branch.
2. Make your changes and add/update tests if applicable.
3. Run `npm test && npm run lint && npm run build` — all must pass.
4. Open a pull request with a clear description of what and why.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).
