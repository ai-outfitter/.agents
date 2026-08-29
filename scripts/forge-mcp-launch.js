#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { requestForgeToken } = require("./forge-token");

const [role, tools] = process.argv.slice(2);

function installWorkspaceHelpers() {
  const directory = path.join(os.homedir(), ".forge");
  const catalog = path.dirname(__dirname);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);

  const writes = [
    [path.join(__dirname, "forge-token.js"), path.join(directory, "forge-token.js"), 0o600],
    [path.join(__dirname, "forge-git-askpass.js"), path.join(directory, "forge-git-askpass.js"), 0o700],
    [path.join(__dirname, "run-repository-checks.js"), path.join(directory, "run-repository-checks.js"), 0o700],
    [Buffer.from(`${catalog}\n`), path.join(directory, "catalog-path"), 0o600],
  ];
  for (const [source, destination, mode] of writes) {
    const temporary = `${destination}.${process.pid}.${role}.tmp`;
    try {
      if (Buffer.isBuffer(source)) {
        const descriptor = fs.openSync(temporary, "wx", mode);
        try {
          fs.writeFileSync(descriptor, source);
        } finally {
          fs.closeSync(descriptor);
        }
      } else {
        fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
        fs.chmodSync(temporary, mode);
      }
      fs.renameSync(temporary, destination);
    } finally {
      try {
        fs.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
}

async function main() {
  if (!role || !tools) throw new Error("usage: forge-mcp-launch.js <role> <tools>");
  installWorkspaceHelpers();
  const token = await requestForgeToken({ role });

  const child = spawnSync("github-mcp-server", ["stdio", "--tools", tools], {
    stdio: "inherit",
    env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
  });
  if (child.error) throw child.error;
  process.exit(child.status ?? 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
