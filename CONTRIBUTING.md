# Contributing to source-viz

Thanks for your interest! Here's how to get started.

## Development setup

```bash
git clone https://github.com/EnixCoda/source-viz.git
cd source-viz
pnpm install
pnpm dev          # start Vite dev server
```

### Available scripts

```bash
pnpm dev          # start dev server
pnpm test         # run tests
pnpm lint         # lint
pnpm build        # production build
pnpm build:cli    # bundle CLI to dist-cli/
pnpm generate-demo  # regenerate public/demo-data.json
```

## Running tests

```bash
pnpm test              # run all tests
pnpm test -- --watch   # watch mode
```

## Code style

- TypeScript + React. Formatting is handled by Prettier (config in `package.json`).
- Lint with `pnpm lint` before submitting a PR.
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
3. Run `pnpm test && pnpm lint && pnpm build` — all must pass.
4. Open a pull request with a clear description of what and why.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).
