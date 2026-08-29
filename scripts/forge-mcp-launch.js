#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const [role, tools] = process.argv.slice(2);
const credentialsPath = process.env.A2A_CREDENTIALS_PATH;
const tokenUrl = process.env.FORGE_TOKEN_URL;

function installWorkspaceHelpers() {
  const directory = path.join(os.homedir(), ".forge");
  const catalog = path.dirname(__dirname);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);

  const writes = [
    [path.join(__dirname, "forge-git-askpass.js"), path.join(directory, "forge-git-askpass.js"), 0o700],
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
  if (!credentialsPath || !tokenUrl) throw new Error("missing forge token environment");
  if (!/^https?:\/\//.test(tokenUrl)) throw new Error("FORGE_TOKEN_URL must use http or https");
  installWorkspaceHelpers();

  let document;
  try {
    document = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  } catch {
    throw new Error("forge credential document was not JSON");
  }
  const credential = document.credentials?.find(({ principal }) => principal === "forge-app");
  if (!credential?.token) throw new Error("missing forge-app A2A credential");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error(`forge token request failed: ${response.status}`);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("forge token response was not JSON");
  }
  const { token } = payload;
  if (!token) throw new Error("forge token response missing token");

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
