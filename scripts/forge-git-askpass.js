#!/usr/bin/env node

const fs = require("node:fs");

const prompt = process.argv[2] ?? "";

async function main() {
  if (/username/i.test(prompt)) {
    process.stdout.write("x-access-token\n");
    return;
  }
  if (!/password/i.test(prompt)) throw new Error("unsupported git credential prompt");

  const credentialsPath = process.env.A2A_CREDENTIALS_PATH;
  const tokenUrl = process.env.FORGE_TOKEN_URL;
  const repository = process.env.FORGE_REPOSITORY;
  if (!credentialsPath || !tokenUrl || !repository) {
    throw new Error("missing forge token environment");
  }
  if (!/^https?:\/\//.test(tokenUrl)) throw new Error("FORGE_TOKEN_URL must use http or https");
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error("invalid FORGE_REPOSITORY");

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
    body: JSON.stringify({ role: "implementer", repository }),
  });
  if (!response.ok) throw new Error(`forge token request failed: ${response.status}`);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("forge token response was not JSON");
  }
  if (!payload.token) throw new Error("forge token response missing token");
  process.stdout.write(`${payload.token}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
