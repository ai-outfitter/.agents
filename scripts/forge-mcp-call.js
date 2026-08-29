#!/usr/bin/env node

const fs = require("node:fs");
const readline = require("node:readline");
const { spawn } = require("node:child_process");
const { requestForgeToken } = require("./forge-token");
const { ensureGithubMcpServer, verifyGithubMcpServer } = require("./ensure-github-mcp-server");

const [role, inputPath] = process.argv.slice(2);
const ROLE_TOOLS = Object.freeze({
  implementer: ["get_me", "issue_read", "get_file_contents", "create_pull_request", "add_issue_comment"],
  reviewer: ["get_me", "pull_request_read", "get_file_contents", "pull_request_review_write", "add_comment_to_pending_review"],
});

function readInput() {
  const text = inputPath ? fs.readFileSync(inputPath, "utf8") : fs.readFileSync(0, "utf8");
  let requests;
  try {
    requests = JSON.parse(text);
  } catch {
    throw new Error("MCP request batch was not JSON");
  }
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error("MCP request batch must be a non-empty JSON list");
  }
  const ids = new Set();
  for (const request of requests) {
    if (request?.method !== "tools/call" || !request.params?.name || request.id === undefined) {
      throw new Error("each batch item must be an identified tools/call request");
    }
    if (request.id === "forge-initialize" || ids.has(request.id)) {
      throw new Error("MCP request ids must be unique and reserved ids may not be used");
    }
    ids.add(request.id);
  }
  return requests;
}

function send(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function main() {
  const allowedTools = ROLE_TOOLS[role];
  if (!allowedTools) throw new Error("usage: forge-mcp-call.js <implementer|reviewer> [request-file]");
  const repository = process.env.FORGE_REPOSITORY;
  if (!repository) throw new Error("missing forge token environment");
  const requests = readInput();
  for (const request of requests) {
    if (!allowedTools.includes(request.params.name)) {
      throw new Error(`MCP tool ${request.params.name} is not allowed for role ${role}`);
    }
  }
  const token = await requestForgeToken({ role, repository });
  const serverPath = await ensureGithubMcpServer();
  verifyGithubMcpServer(serverPath);
  const child = spawn(serverPath, ["stdio", "--tools", allowedTools.join(",")], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token },
  });
  const pending = new Map();
  let childError;
  child.once("error", (error) => {
    childError = error;
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  });
  const lines = readline.createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      child.kill();
      for (const { reject } of pending.values()) reject(new Error("MCP server emitted invalid JSON"));
      return;
    }
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      message.error ? waiter.reject(new Error(`MCP error: ${message.error.message ?? "request failed"}`)) : waiter.resolve(message.result);
    }
  });
  child.once("close", (status) => {
    for (const { reject } of pending.values()) {
      reject(new Error(`github-mcp-server exited with status ${status}`));
    }
    pending.clear();
  });

  function call(message) {
    return new Promise((resolve, reject) => {
      pending.set(message.id, { resolve, reject });
      send(child, message);
    });
  }

  const initialized = await call({
    jsonrpc: "2.0",
    id: "forge-initialize",
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "forge-mcp-call", version: "1" } },
  });
  if (!initialized) throw new Error("MCP initialize returned no result");
  send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

  for (const request of requests) {
    const result = await call({ jsonrpc: "2.0", ...request });
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
    if (result?.isError) throw new Error(`MCP tool ${request.params.name} failed`);
  }
  child.stdin.end();
  const status = await new Promise((resolve) => child.once("close", resolve));
  if (childError) throw childError;
  if (status !== 0) throw new Error(`github-mcp-server exited with status ${status}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
