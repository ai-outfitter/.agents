#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const VERSION = "v1.8.0";
const SYSTEM_TOOLS = Object.freeze({
  tar: Object.freeze(["/usr/bin/tar", "/bin/tar"]),
});
// Archive digests are from the v1.8.0 release checksums.txt:
// https://github.com/github/github-mcp-server/releases/download/v1.8.0/checksums.txt
// archiveBinarySha256 was derived by extracting github-mcp-server from each
// checked archive. imageBinarySha256 was derived by copying
// /server/github-mcp-server from ghcr.io/github/github-mcp-server:v1.8.0:
// linux/amd64 image sha256:7c23dc82b37e7122a162741acc6573d42f836e5b89499b3af751d00410901658
// linux/arm64 image sha256:7f503f5cc1c3f4d38ab3fd45e7ac5be11400ff46153e1cd8162afa86349c0540
// and running sha256sum on each copied binary.
const RELEASES = Object.freeze({
  x86_64: Object.freeze({
    archive: "github-mcp-server_Linux_x86_64.tar.gz",
    archiveSha256: "b2754921aec1b1302b19a71531d26d242ef0e7f1e05696b8444beab5a7e61d5b",
    archiveBinarySha256: "f9c7846aebc56ea19dd00d6404f2d9041cd80871dec2fbaf0e5a5842df36f7ce",
    imageBinarySha256: "ad39fbe2ffe3caf07abaeaa0d6ce16699bc897420dd8fee103d0502e670757a9",
  }),
  aarch64: Object.freeze({
    archive: "github-mcp-server_Linux_arm64.tar.gz",
    archiveSha256: "c4b0fe8d4e31c079e5c3f3a54050a08449dae6fa8189ec5998822555ad27bde8",
    archiveBinarySha256: "fcdfa9be71fa682e3abc1facedaa9a7f59527dcd68cc625d355ab7ce620f4ae0",
    imageBinarySha256: "9ff3264f1e87f4e3b322744d7a8d1d7aeef1ebc259866647bd1b97a41811fe3d",
  }),
});

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function findOnPath(name, searchPath = process.env.PATH ?? "") {
  for (const directory of searchPath.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.resolve(directory, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Keep searching.
    }
  }
  return undefined;
}

function absoluteTool(name) {
  const tool = SYSTEM_TOOLS[name]?.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
  if (!tool) throw new Error(`could not find ${name} at an allowed absolute path`);
  return tool;
}

function releaseForRuntime() {
  const architecture = { x64: "x86_64", arm64: "aarch64" }[process.arch];
  const release = RELEASES[architecture];
  if (!release) throw new Error(`unsupported github-mcp-server architecture: ${process.arch}`);
  return release;
}

function verifyGithubMcpServer(serverPath, release = releaseForRuntime()) {
  let digest;
  try {
    digest = sha256(serverPath);
  } catch (error) {
    throw new Error(`could not verify github-mcp-server: ${error.message}`);
  }
  if (![release.archiveBinarySha256, release.imageBinarySha256].includes(digest)) {
    throw new Error(`sha256 mismatch for github-mcp-server at ${serverPath}`);
  }
  return serverPath;
}

async function ensureGithubMcpServer() {
  const release = releaseForRuntime();
  const existing = findOnPath("github-mcp-server");
  if (existing) return verifyGithubMcpServer(existing, release);

  const home = process.env.HOME || os.homedir();
  if (!home) throw new Error("HOME is required to install github-mcp-server");
  const binDirectory = path.join(home, ".local", "bin");
  const destination = path.join(binDirectory, "github-mcp-server");
  try {
    verifyGithubMcpServer(destination, release);
    fs.chmodSync(destination, 0o755);
    return destination;
  } catch {
    // A missing or unreadable local copy is replaced below.
  }

  fs.mkdirSync(binDirectory, { recursive: true, mode: 0o755 });
  const temporary = fs.mkdtempSync(path.join(binDirectory, ".github-mcp-server-"));
  try {
    const archivePath = path.join(temporary, release.archive);
    const url = `https://github.com/github/github-mcp-server/releases/download/${VERSION}/${release.archive}`;
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      throw new Error(`download failed: ${error.message}`);
    }
    if (!response.ok) throw new Error(`download failed with HTTP ${response.status}`);
    fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
    if (sha256(archivePath) !== release.archiveSha256) {
      throw new Error(`sha256 mismatch for ${release.archive}`);
    }

    const extractedDirectory = path.join(temporary, "extracted");
    fs.mkdirSync(extractedDirectory, { mode: 0o700 });
    const extracted = spawnSync(absoluteTool("tar"), ["-xzf", archivePath, "-C", extractedDirectory, "github-mcp-server"], {
      encoding: "utf8",
    });
    if (extracted.error) throw new Error(`could not run tar: ${extracted.error.message}`);
    if (extracted.status !== 0) throw new Error(`could not extract github-mcp-server: ${extracted.stderr.trim()}`);
    const extractedBinary = path.join(extractedDirectory, "github-mcp-server");
    if (sha256(extractedBinary) !== release.archiveBinarySha256) {
      throw new Error("sha256 mismatch for extracted github-mcp-server");
    }
    fs.chmodSync(extractedBinary, 0o755);
    fs.renameSync(extractedBinary, destination);
    return destination;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (require.main === module) {
  ensureGithubMcpServer()
    .then((serverPath) => process.stdout.write(`${serverPath}\n`))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { VERSION, RELEASES, findOnPath, verifyGithubMcpServer, ensureGithubMcpServer };
