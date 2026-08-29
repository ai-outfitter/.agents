#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

function runDriver(args, requests, env = {}) {
  const child = spawn(process.execPath, [path.join(__dirname, "forge-mcp-call.js"), ...args], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(JSON.stringify(requests));
  return child;
}

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "forge-mcp-call-test-"));
  const credentials = path.join(temporary, "credentials.json");
  const server = path.join(temporary, "github-mcp-server");
  fs.writeFileSync(credentials, JSON.stringify({ credentials: [{ principal: "forge-app", token: "a2a-secret" }] }));
  fs.writeFileSync(server, `#!/usr/bin/env node
require("node:fs").writeFileSync(process.env.ARGS_PATH, JSON.stringify(process.argv.slice(2)));
const readline = require("node:readline");
const lines = readline.createInterface({ input: process.stdin });
let initialized = false;
lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "stub", version: "1" } } }) + "\\n");
  } else if (message.method === "notifications/initialized") {
    initialized = true;
  } else if (message.method === "tools/call") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: JSON.stringify({ initialized, name: message.params.name }) }] } }) + "\\n");
  }
});
`);
  fs.chmodSync(server, 0o700);

  const missingRepository = runDriver(["reviewer"], [
    { id: 1, method: "tools/call", params: { name: "pull_request_read", arguments: {} } },
  ]);
  let missingRepositoryStderr = "";
  missingRepository.stderr.on("data", (chunk) => { missingRepositoryStderr += chunk; });
  assert.notEqual(await new Promise((resolve) => missingRepository.on("close", resolve)), 0);
  assert.match(missingRepositoryStderr, /missing forge token environment/);

  let brokerRequest;
  const broker = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      brokerRequest = { authorization: request.headers.authorization, body: JSON.parse(body) };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ token: "github-secret" }));
    });
  });
  await new Promise((resolve) => broker.listen(0, "127.0.0.1", resolve));

  const forbidden = runDriver(["reviewer"], [
    { id: 1, method: "tools/call", params: { name: "create_pull_request", arguments: {} } },
  ], { FORGE_REPOSITORY: "ai-outfitter/.agents" });
  let forbiddenStderr = "";
  forbidden.stderr.on("data", (chunk) => { forbiddenStderr += chunk; });
  assert.notEqual(await new Promise((resolve) => forbidden.on("close", resolve)), 0);
  assert.match(forbiddenStderr, /not allowed for role reviewer/);

  const requests = [
    { id: 1, method: "tools/call", params: { name: "pull_request_read", arguments: { owner: "ai-outfitter" } } },
    { id: 2, method: "tools/call", params: { name: "pull_request_review_write", arguments: { method: "create" } } },
  ];
  const child = spawn(process.execPath, [path.join(__dirname, "forge-mcp-call.js"), "reviewer"], {
    env: {
      ...process.env,
      PATH: `${temporary}:${process.env.PATH}`,
      A2A_CREDENTIALS_PATH: credentials,
      FORGE_TOKEN_URL: `http://127.0.0.1:${broker.address().port}`,
      FORGE_REPOSITORY: "ai-outfitter/.agents",
      ARGS_PATH: path.join(temporary, "args.json"),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(JSON.stringify(requests));
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const status = await new Promise((resolve) => child.on("close", resolve));
  broker.close();

  assert.equal(status, 0, stderr);
  assert.deepEqual(brokerRequest, {
    authorization: "Bearer a2a-secret",
    body: { role: "reviewer", repository: "ai-outfitter/.agents" },
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temporary, "args.json"), "utf8")), [
    "stdio",
    "--tools",
    "get_me,pull_request_read,get_file_contents,pull_request_review_write,add_comment_to_pending_review,submit_pending_pull_request_review",
  ]);
  const results = stdout.trim().split("\n").map(JSON.parse);
  assert.deepEqual(results.map(({ id }) => id), [1, 2]);
  for (const result of results) {
    assert.equal(JSON.parse(result.result.content[0].text).initialized, true);
  }
  assert(!`${stdout}${stderr}`.includes("github-secret"));
  assert(!`${stdout}${stderr}`.includes("a2a-secret"));
  process.stdout.write("forge-mcp-call integration test passed\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
