.SHELLFLAGS := -lc

.PHONY: setup fmt lint test build docs

setup:
	python -m pip install --upgrade pip
	python -m pip install -r requirements-dev.txt
	npm install --workspaces --include-workspace-root --no-audit --no-fund

build:
	python -m compileall src
	npm --prefix web/console run build

docs:
	python -m sphinx -b html docs docs/_build/html

fmt:
	black .
	npm --prefix web/console run fmt:console

lint:
	black --check .
	ruff check .
	npm --prefix web/console run lint:console

test:
	pytest -q --cov=src
	npm --prefix web/console test -- --ci
