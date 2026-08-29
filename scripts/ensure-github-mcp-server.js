#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const VERSION = "v1.8.0";
const RELEASES = Object.freeze({
  x86_64: Object.freeze({
    archive: "github-mcp-server_Linux_x86_64.tar.gz",
    archiveSha256: "b2754921aec1b1302b19a71531d26d242ef0e7f1e05696b8444beab5a7e61d5b",
    binarySha256: "f9c7846aebc56ea19dd00d6404f2d9041cd80871dec2fbaf0e5a5842df36f7ce",
  }),
  aarch64: Object.freeze({
    archive: "github-mcp-server_Linux_arm64.tar.gz",
    archiveSha256: "c4b0fe8d4e31c079e5c3f3a54050a08449dae6fa8189ec5998822555ad27bde8",
    binarySha256: "fcdfa9be71fa682e3abc1facedaa9a7f59527dcd68cc625d355ab7ce620f4ae0",
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

async function ensureGithubMcpServer() {
  const existing = findOnPath("github-mcp-server");
  if (existing) return existing;

  const uname = spawnSync("uname", ["-m"], { encoding: "utf8" });
  if (uname.error) throw new Error(`could not run uname: ${uname.error.message}`);
  if (uname.status !== 0) throw new Error(`could not determine architecture: ${uname.stderr.trim()}`);
  const architecture = uname.stdout.trim();
  const release = RELEASES[architecture];
  if (!release) throw new Error(`unsupported github-mcp-server architecture: ${architecture}`);

  const home = process.env.HOME || os.homedir();
  if (!home) throw new Error("HOME is required to install github-mcp-server");
  const binDirectory = path.join(home, ".local", "bin");
  const destination = path.join(binDirectory, "github-mcp-server");
  try {
    if (sha256(destination) === release.binarySha256) {
      fs.chmodSync(destination, 0o755);
      return destination;
    }
  } catch {
    // A missing or unreadable local copy is replaced below.
  }

  fs.mkdirSync(binDirectory, { recursive: true, mode: 0o755 });
  const temporary = fs.mkdtempSync(path.join(binDirectory, ".github-mcp-server-"));
  try {
    const archivePath = path.join(temporary, release.archive);
    const url = `https://github.com/github/github-mcp-server/releases/download/${VERSION}/${release.archive}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`download failed with HTTP ${response.status}`);
    fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
    if (sha256(archivePath) !== release.archiveSha256) {
      throw new Error(`sha256 mismatch for ${release.archive}`);
    }

    const extractedDirectory = path.join(temporary, "extracted");
    fs.mkdirSync(extractedDirectory, { mode: 0o700 });
    const extracted = spawnSync("tar", ["-xzf", archivePath, "-C", extractedDirectory, "github-mcp-server"], {
      encoding: "utf8",
    });
    if (extracted.error) throw new Error(`could not run tar: ${extracted.error.message}`);
    if (extracted.status !== 0) throw new Error(`could not extract github-mcp-server: ${extracted.stderr.trim()}`);
    const extractedBinary = path.join(extractedDirectory, "github-mcp-server");
    if (sha256(extractedBinary) !== release.binarySha256) {
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

module.exports = { VERSION, RELEASES, findOnPath, ensureGithubMcpServer };
