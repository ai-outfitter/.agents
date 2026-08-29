#!/usr/bin/env node

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const [role, tools] = process.argv.slice(2);
const credentialsPath = process.env.A2A_CREDENTIALS_PATH;
const tokenUrl = process.env.FORGE_TOKEN_URL;

async function main() {
  if (!role || !tools) throw new Error("usage: forge-mcp-launch.js <role> <tools>");
  if (!credentialsPath || !tokenUrl) throw new Error("missing forge token environment");
  if (!/^https?:\/\//.test(tokenUrl)) throw new Error("FORGE_TOKEN_URL must use http or https");

  const document = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
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

  const { token } = await response.json();
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
