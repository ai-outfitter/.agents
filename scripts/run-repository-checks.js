#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: run-repository-checks.js <command> [args...]");
  process.exit(2);
}

const child = spawnSync(command, args, {
  stdio: "inherit",
  env: {
    HOME: process.env.HOME,
    PATH: process.env.PATH,
  },
});
if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}
process.exit(child.status ?? 1);
