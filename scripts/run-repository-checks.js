#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: run-repository-checks.js <command> [args...]");
  process.exit(2);
}

const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), "resident-checks-"));
fs.chmodSync(isolatedHome, 0o700);

try {
  const child = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      HOME: isolatedHome,
      PATH: process.env.PATH,
    },
  });
  if (child.error) {
    console.error(child.error.message);
    process.exitCode = 1;
  } else {
    process.exitCode = child.status ?? 1;
  }
} finally {
  fs.rmSync(isolatedHome, { recursive: true, force: true });
}
