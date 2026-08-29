const fs = require("node:fs");

const ROLES = new Set(["implementer", "reviewer"]);

function validateRepository(repository) {
  if (repository !== undefined && !/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error("invalid FORGE_REPOSITORY");
  }
  const organization = process.env.FORGE_ORGANIZATION;
  if (repository !== undefined) {
    if (!organization) throw new Error("FORGE_ORGANIZATION is required");
    if (repository.split("/", 1)[0] !== organization) {
      throw new Error("FORGE_REPOSITORY owner must equal FORGE_ORGANIZATION");
    }
  }
}

async function requestForgeToken({ role, repository }) {
  const credentialsPath = process.env.A2A_CREDENTIALS_PATH;
  const tokenUrl = process.env.FORGE_TOKEN_URL;
  if (!credentialsPath || !tokenUrl) throw new Error("missing forge token environment");
  if (!/^https?:\/\//.test(tokenUrl)) throw new Error("FORGE_TOKEN_URL must use http or https");
  if (!ROLES.has(role)) throw new Error("forge token role must be implementer or reviewer");
  validateRepository(repository);

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
    body: JSON.stringify(repository ? { role, repository } : { role }),
  });
  if (!response.ok) throw new Error(`forge token request failed: ${response.status}`);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("forge token response was not JSON");
  }
  if (!payload.token) throw new Error("forge token response missing token");
  return payload.token;
}

module.exports = { requestForgeToken };
