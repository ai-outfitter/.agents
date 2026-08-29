#!/usr/bin/env node

const { requestForgeToken } = require("./forge-token");

const prompt = process.argv[2] ?? "";

async function main() {
  if (/username/i.test(prompt)) {
    process.stdout.write("x-access-token\n");
    return;
  }
  if (!/password/i.test(prompt)) throw new Error("unsupported git credential prompt");

  const repository = process.env.FORGE_REPOSITORY;
  const role = process.env.FORGE_TOKEN_ROLE ?? "implementer";
  if (!repository) throw new Error("missing forge token environment");
  process.stdout.write(`${await requestForgeToken({ role, repository })}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
