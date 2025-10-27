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

### One-command dev servers (Windows PowerShell)

- Double-click `scripts\dev.bat` (or run `pwsh -ExecutionPolicy Bypass -File .\scripts\dev.ps1`) to spin up the API and console. The launcher ensures the virtualenv exists, installs dependencies if needed, terminates lingering listeners on ports `9000`/`5173`, then opens two shells running uvicorn and Vite. Progress and errors are also written to `logs/dev-launcher.log`, and the browser is opened to `http://localhost:5173/jobs`. You can copy `dev.bat` anywhere (e.g. Desktop); it always targets the repository at `C:\dev\zimusyoku`—update `REPO_ROOT` inside the batch file if you relocate the repo.
- Optional flags when running via PowerShell: `-SkipInstall` to reuse existing dependencies, `-KeepPorts` to leave running processes on those ports untouched, `-NoBrowser` to skip auto-opening the UI, `-NoWait` to return control immediately instead of prompting at the end.
- Close the spawned windows or press `Ctrl+C` inside them to stop the servers.

See `AGENTS.md` for the authoritative contributor workflow, including style, QA, build, and PR policies.

## Verification

Run the required checks locally before opening a PR:

```bash
pip install -r requirements.txt
black --check . && ruff check .
pytest -q --cov=src
# npm ci && npm run lint:console && npm test -- --ci  # when web/console changes
```
