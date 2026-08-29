#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { VERSION, RELEASES, ensureGithubMcpServer } = require("./ensure-github-mcp-server");

assert.equal(VERSION, "v1.8.0");
assert.deepEqual(RELEASES, {
  x86_64: {
    archive: "github-mcp-server_Linux_x86_64.tar.gz",
    archiveSha256: "b2754921aec1b1302b19a71531d26d242ef0e7f1e05696b8444beab5a7e61d5b",
    archiveBinarySha256: "f9c7846aebc56ea19dd00d6404f2d9041cd80871dec2fbaf0e5a5842df36f7ce",
    imageBinarySha256: "ad39fbe2ffe3caf07abaeaa0d6ce16699bc897420dd8fee103d0502e670757a9",
  },
  aarch64: {
    archive: "github-mcp-server_Linux_arm64.tar.gz",
    archiveSha256: "c4b0fe8d4e31c079e5c3f3a54050a08449dae6fa8189ec5998822555ad27bde8",
    archiveBinarySha256: "fcdfa9be71fa682e3abc1facedaa9a7f59527dcd68cc625d355ab7ce620f4ae0",
    imageBinarySha256: "9ff3264f1e87f4e3b322744d7a8d1d7aeef1ebc259866647bd1b97a41811fe3d",
  },
});
for (const release of Object.values(RELEASES)) {
  assert.match(release.archive, /^github-mcp-server_Linux_(arm64|x86_64)\.tar\.gz$/);
  assert.match(release.archiveSha256, /^[a-f0-9]{64}$/);
  assert.match(release.archiveBinarySha256, /^[a-f0-9]{64}$/);
  assert.match(release.imageBinarySha256, /^[a-f0-9]{64}$/);
}

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ensure-github-mcp-server-test-"));
  const originalPath = process.env.PATH;
  const originalHome = process.env.HOME;
  try {
    const server = path.join(temporary, "github-mcp-server");
    fs.writeFileSync(server, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    process.env.PATH = `${temporary}${path.delimiter}${originalPath}`;
    process.env.HOME = path.join(temporary, "home");
    await assert.rejects(ensureGithubMcpServer(), /sha256 mismatch for github-mcp-server/);
    assert.equal(fs.existsSync(path.join(process.env.HOME, ".local", "bin", "github-mcp-server")), false);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  process.stdout.write("ensure-github-mcp-server tests passed\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
