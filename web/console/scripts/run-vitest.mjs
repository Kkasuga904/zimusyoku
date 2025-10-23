#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, "..", "node_modules", ".bin"),
  resolve(here, "..", "..", "node_modules", ".bin"),
  resolve(here, "..", "..", "..", "node_modules", ".bin")
];
const binaryName = process.platform === "win32" ? "vitest.cmd" : "vitest";
const vitestBin = candidates
  .map((dir) => resolve(dir, binaryName))
  .find((bin) => existsSync(bin));

if (!vitestBin) {
  console.error("Unable to locate vitest binary");
  process.exit(1);
}

const extra = process.argv.slice(2).filter((arg) => arg !== "--ci");
const result = spawnSync(vitestBin, ["run", "--coverage", ...extra], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);