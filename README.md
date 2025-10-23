# Universal Paste Engine Automation Sandbox

This repository provides a reference environment for the universal paste engine agents.

## Contents

- Python extractor service (`src/`, `services/extractor/`) with pytest + coverage wiring.
- React/TypeScript console (`web/console/`) bootstrapped with Vite, Vitest, ESLint, and Prettier.
- Documentation harness under `docs/` (Sphinx) and contributor guidance in `AGENTS.md`.
- Shared automation targets defined in `Makefile` plus root workspace `package.json` for JS tooling.

## Getting Started

```bash
make setup          # install Python + Node toolchains
make build          # compile Python package and bundle the console
pytest --cov=src    # run extractor tests with coverage
npm --prefix web/console test -- --ci  # TypeScript unit/coverage
make docs           # generate Sphinx HTML docs
```

See `AGENTS.md` for the authoritative contributor workflow, including style, QA, build, and PR policies.
