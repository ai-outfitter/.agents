#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

// GitHub CLI renders App authors as app/dependabot, while API responses may
// expose the same actor as dependabot[bot]. Accept only those two forms.
const DEPENDABOT_LOGINS = new Set(["app/dependabot", "dependabot[bot]"]);
const DEFAULT_TIMEOUT_SECONDS = 300;
const DEFAULT_POLL_SECONDS = 10;
const MAX_REBASE_ROUNDS = 3;

const PR_FIELDS = [
  "author",
  "baseRefName",
  "headRefOid",
  "id",
  "isDraft",
  "mergeStateStatus",
  "mergeable",
  "number",
  "state",
  "title",
  "url",
].join(",");

export function parsePullRequestNumbers(value = "") {
  if (!value.trim()) return [];

  const numbers = value
    .split(/[\s,]+/u)
    .filter(Boolean)
    .map((part) => part.replace(/^#/u, ""))
    .map((part) => {
      if (!/^\d+$/u.test(part) || Number(part) < 1) {
        throw new Error(`Invalid pull request number: ${part}`);
      }
      return Number(part);
    });

  return [...new Set(numbers)];
}

export function validateRepository(repository) {
  if (!/^ai-outfitter\/[A-Za-z0-9._-]+$/u.test(repository)) {
    throw new Error(
      `Repository must be an ai-outfitter repository in owner/name form; received: ${repository}`,
    );
  }
}

export function validateCandidate(pr, baseBranch) {
  const reasons = [];

  if (pr.state !== "OPEN") reasons.push(`state is ${pr.state}`);
  if (!DEPENDABOT_LOGINS.has(pr.author?.login)) {
    reasons.push(`author is ${pr.author?.login ?? "unknown"}`);
  }
  if (pr.baseRefName !== baseBranch) {
    reasons.push(`base is ${pr.baseRefName}, not ${baseBranch}`);
  }
  if (pr.isDraft) reasons.push("pull request is a draft");

  return reasons;
}

export function automaticRebaseBlocker(pr) {
  if (pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY") {
    return "has merge conflicts that an automatic rebase cannot resolve";
  }
  return null;
}

export function needsAnotherRebase(pr) {
  return pr.mergeStateStatus === "BEHIND";
}

export function isMergeabilityPending(pr) {
  return (
    !pr.headRefOid ||
    pr.mergeable === "UNKNOWN" ||
    pr.mergeStateStatus === "UNKNOWN"
  );
}

export function classifyRequiredChecks(checks) {
  if (checks.length === 0) return { state: "missing", checks: [] };

  const failed = checks.filter((check) =>
    ["cancel", "fail"].includes(check.bucket),
  );
  if (failed.length > 0) return { state: "failed", checks: failed };

  const pending = checks.filter((check) => check.bucket === "pending");
  if (pending.length > 0) return { state: "pending", checks: pending };

  return { state: "passed", checks };
}

export function parseOptions(argv, env = process.env) {
  const options = {
    repository: env.TARGET_REPOSITORY ?? "",
    pullRequests: env.PULL_REQUESTS ?? "",
    execute: /^(1|true|yes)$/iu.test(env.EXECUTE ?? "false"),
    timeoutSeconds: Number(
      env.REBASE_TIMEOUT_SECONDS ?? DEFAULT_TIMEOUT_SECONDS,
    ),
    pollSeconds: Number(env.REBASE_POLL_SECONDS ?? DEFAULT_POLL_SECONDS),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];

    if (argument === "--repository" && next) {
      options.repository = next;
      index += 1;
    } else if (argument === "--pull-requests" && next) {
      options.pullRequests = next;
      index += 1;
    } else if (argument === "--execute") {
      options.execute = true;
    } else if (argument === "--timeout-seconds" && next) {
      options.timeoutSeconds = Number(next);
      index += 1;
    } else if (argument === "--poll-seconds" && next) {
      options.pollSeconds = Number(next);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!options.repository) {
    throw new Error(
      "A target repository is required via --repository or TARGET_REPOSITORY.",
    );
  }
  validateRepository(options.repository);

  for (const [name, value] of [
    ["timeout", options.timeoutSeconds],
    ["poll interval", options.pollSeconds],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`The ${name} must be a positive number.`);
    }
  }

  return options;
}

export class GitHubCli {
  constructor({ binary = process.env.GH_BIN ?? "gh", env = process.env } = {}) {
    this.binary = binary;
    this.env = env;
  }

  result(args) {
    const result = spawnSync(this.binary, args, {
      encoding: "utf8",
      env: this.env,
    });

    if (result.error) throw result.error;
    return {
      status: result.status ?? 1,
      stderr: result.stderr.trim(),
      stdout: result.stdout.trim(),
    };
  }

  run(args) {
    const result = this.result(args);
    if (result.status !== 0) {
      const detail = (
        result.stderr ||
        result.stdout ||
        "unknown gh error"
      ).trim();
      throw new Error(`gh ${args.join(" ")} failed: ${detail}`);
    }

    return result.stdout.trim();
  }

  json(args) {
    const output = this.run(args);
    return output ? JSON.parse(output) : null;
  }
}

function splitRepository(repository) {
  const [owner, name] = repository.split("/", 2);
  return { owner, name };
}

function getPullRequest(gh, repository, number) {
  return gh.json([
    "pr",
    "view",
    String(number),
    "--repo",
    repository,
    "--json",
    PR_FIELDS,
  ]);
}

function listPullRequests(gh, repository, baseBranch) {
  return gh.json([
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "open",
    "--base",
    baseBranch,
    "--limit",
    "1000",
    "--json",
    PR_FIELDS,
  ]);
}

export function selectCandidates({
  gh,
  repository,
  baseBranch,
  requestedNumbers,
}) {
  const candidates = requestedNumbers.length
    ? requestedNumbers.map((number) => getPullRequest(gh, repository, number))
    : listPullRequests(gh, repository, baseBranch)
        .filter((pr) => DEPENDABOT_LOGINS.has(pr.author?.login))
        .sort((left, right) => left.number - right.number);

  const invalid = candidates
    .map((pr) => ({ pr, reasons: validateCandidate(pr, baseBranch) }))
    .filter(({ reasons }) => reasons.length > 0);

  if (invalid.length > 0) {
    const detail = invalid
      .map(({ pr, reasons }) => `#${pr.number}: ${reasons.join(", ")}`)
      .join("; ");
    throw new Error(`Refusing ineligible pull request selection: ${detail}`);
  }

  return candidates;
}

export function inspectRepository(gh, repository, baseBranch) {
  const { owner, name } = splitRepository(repository);
  const query = `
    query($owner: String!, $name: String!, $branch: String!) {
      repository(owner: $owner, name: $name) {
        autoMergeAllowed
        mergeQueue(branch: $branch) { id }
      }
    }
  `;
  const response = gh.json([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
    "-F",
    `branch=${baseBranch}`,
  ]);
  const data = response?.data?.repository;

  if (!data) {
    throw new Error(`Could not inspect ${repository}.`);
  }

  return {
    autoMergeAllowed: data.autoMergeAllowed === true,
    hasMergeQueue: Boolean(data.mergeQueue?.id),
  };
}

function getDefaultBranch(gh, repository) {
  return gh.run([
    "repo",
    "view",
    repository,
    "--json",
    "defaultBranchRef",
    "--jq",
    ".defaultBranchRef.name",
  ]);
}

function getQueueEntry(gh, pullRequestId) {
  const query = `
    query($id: ID!) {
      node(id: $id) {
        ... on PullRequest {
          mergeQueueEntry { id position }
        }
      }
    }
  `;
  const response = gh.json([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `id=${pullRequestId}`,
  ]);
  return response?.data?.node?.mergeQueueEntry ?? null;
}

function enqueuePullRequest(gh, pr) {
  const mutation = `
    mutation($pullRequestId: ID!, $expectedHeadOid: GitObjectID!) {
      enqueuePullRequest(input: {
        pullRequestId: $pullRequestId
        expectedHeadOid: $expectedHeadOid
        jump: false
      }) {
        mergeQueueEntry { id position }
      }
    }
  `;
  const response = gh.json([
    "api",
    "graphql",
    "-f",
    `query=${mutation}`,
    "-F",
    `pullRequestId=${pr.id}`,
    "-F",
    `expectedHeadOid=${pr.headRefOid}`,
  ]);
  const entry = response?.data?.enqueuePullRequest?.mergeQueueEntry;
  if (!entry?.id) {
    throw new Error(`GitHub did not return a queue entry for #${pr.number}.`);
  }
  return entry;
}

function getRequiredChecks(gh, repository, number) {
  const result = gh.result([
    "pr",
    "checks",
    String(number),
    "--repo",
    repository,
    "--required",
    "--json",
    "bucket,name,state,workflow",
  ]);

  if (result.stdout) {
    try {
      return classifyRequiredChecks(JSON.parse(result.stdout));
    } catch (error) {
      throw new Error(
        `Could not parse required checks for #${number}: ${error.message}`,
      );
    }
  }
  if (/no required checks reported/iu.test(result.stderr)) {
    return { state: "missing", checks: [] };
  }
  if (result.status !== 0) {
    throw new Error(
      `Could not inspect required checks for #${number}: ${result.stderr || "unknown gh error"}`,
    );
  }
  return { state: "missing", checks: [] };
}

function writeSummary(lines, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  const text = `${lines.join("\n")}\n`;
  process.stdout.write(text);
  if (summaryPath) appendFileSync(summaryPath, text);
}

function candidateTable(candidates) {
  return [
    "| PR | Mergeability | Merge state | Title |",
    "| --- | --- | --- | --- |",
    ...candidates.map(
      (pr) =>
        `| [#${pr.number}](${pr.url}) | ${pr.mergeable} | ${pr.mergeStateStatus} | ${pr.title.replaceAll("|", "\\|")} |`,
    ),
  ];
}

async function waitForBatchReadiness({
  gh,
  repository,
  baseBranch,
  numbers,
  timeoutSeconds,
  pollSeconds,
  sleep,
}) {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (true) {
    const snapshots = numbers.map((number) =>
      getPullRequest(gh, repository, number),
    );
    const invalid = snapshots
      .map((pr) => ({
        pr,
        reasons: validateCandidate(pr, baseBranch),
      }))
      .filter(({ reasons }) => reasons.length > 0);
    if (invalid.length > 0) {
      throw new Error(
        `Pull request state changed during the batch: ${invalid
          .map(({ pr, reasons }) => `#${pr.number}: ${reasons.join(", ")}`)
          .join("; ")}`,
      );
    }

    const blockers = snapshots
      .map((pr) => ({ pr, reason: automaticRebaseBlocker(pr) }))
      .filter(({ reason }) => reason);
    if (blockers.length > 0) {
      throw new Error(
        `Automatic rebase blocked: ${blockers
          .map(({ pr, reason }) => `#${pr.number} ${reason}`)
          .join("; ")}`,
      );
    }

    if (!snapshots.some(isMergeabilityPending)) {
      if (snapshots.some(needsAnotherRebase)) {
        return { state: "behind", snapshots };
      }

      const checks = snapshots.map((pr) => ({
        pr,
        result: getRequiredChecks(gh, repository, pr.number),
      }));
      const failed = checks.filter(({ result }) => result.state === "failed");
      if (failed.length > 0) {
        throw new Error(
          `Required checks failed: ${failed
            .map(
              ({ pr, result }) =>
                `#${pr.number} (${result.checks.map((check) => check.name).join(", ")})`,
            )
            .join("; ")}`,
        );
      }
      if (checks.every(({ result }) => result.state === "passed")) {
        return { state: "ready", snapshots };
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for mergeability and required checks for: ${snapshots
          .map((pr) => `#${pr.number}`)
          .join(", ")}`,
      );
    }

    await sleep(pollSeconds * 1000);
  }
}

export async function runBatch(
  options,
  {
    gh = new GitHubCli(),
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) {
  const requestedNumbers = parsePullRequestNumbers(options.pullRequests);
  const baseBranch = getDefaultBranch(gh, options.repository);
  let candidates = selectCandidates({
    gh,
    repository: options.repository,
    baseBranch,
    requestedNumbers,
  });
  const repositoryState = inspectRepository(gh, options.repository, baseBranch);

  const summary = [
    `## Dependabot merge queue: ${options.repository}`,
    "",
    `Mode: **${options.execute ? "execute" : "preview"}**`,
    `Target branch: \`${baseBranch}\``,
    `Merge queue configured: **${repositoryState.hasMergeQueue ? "yes" : "no"}**`,
    `Auto-merge allowed: **${repositoryState.autoMergeAllowed ? "yes" : "no"}**`,
    "",
  ];

  if (candidates.length === 0) {
    writeSummary([
      ...summary,
      "No eligible open Dependabot pull requests found.",
    ]);
    return { candidates: [], queued: [] };
  }

  summary.push(...candidateTable(candidates));

  const blockers = candidates
    .map((pr) => ({ pr, reason: automaticRebaseBlocker(pr) }))
    .filter(({ reason }) => reason);

  if (!options.execute) {
    if (blockers.length > 0) {
      summary.push(
        "",
        `Blocked from an all-or-nothing run: ${blockers
          .map(({ pr }) => `#${pr.number}`)
          .join(", ")} must be resolved or omitted.`,
      );
    }
    if (!repositoryState.hasMergeQueue || !repositoryState.autoMergeAllowed) {
      summary.push(
        "",
        "The repository prerequisites must be configured before execute mode can run.",
      );
    }
    writeSummary(summary);
    return { candidates, queued: [] };
  }

  if (!repositoryState.hasMergeQueue) {
    throw new Error(
      `${options.repository}:${baseBranch} does not have a GitHub merge queue.`,
    );
  }
  if (!repositoryState.autoMergeAllowed) {
    throw new Error(`${options.repository} does not allow auto-merge.`);
  }

  const existingEntries = new Map();
  for (const pr of candidates) {
    const entry = getQueueEntry(gh, pr.id);
    if (entry) existingEntries.set(pr.number, entry);
  }
  let pendingCandidates = candidates.filter(
    (pr) => !existingEntries.has(pr.number),
  );
  const pendingBlockers = pendingCandidates
    .map((pr) => ({ pr, reason: automaticRebaseBlocker(pr) }))
    .filter(({ reason }) => reason);
  if (pendingBlockers.length > 0) {
    throw new Error(
      `No pull requests were rebased or queued because the batch contains conflicts: ${pendingBlockers
        .map(({ pr }) => `#${pr.number}`)
        .join(", ")}`,
    );
  }

  if (pendingCandidates.length === 0) {
    const alreadyQueued = [...existingEntries.keys()];
    writeSummary([
      ...summary,
      "",
      `Already in the merge queue: ${alreadyQueued
        .map((number) => `#${number}`)
        .join(", ")}.`,
    ]);
    return { candidates, queued: [], alreadyQueued, rebased: [] };
  }

  const rebased = new Set();
  for (let round = 0; round <= MAX_REBASE_ROUNDS; round += 1) {
    const readiness = await waitForBatchReadiness({
      gh,
      repository: options.repository,
      baseBranch,
      numbers: pendingCandidates.map((pr) => pr.number),
      timeoutSeconds: options.timeoutSeconds,
      pollSeconds: options.pollSeconds,
      sleep,
    });
    pendingCandidates = readiness.snapshots;

    if (readiness.state === "ready") break;
    const toRebase = pendingCandidates.filter(needsAnotherRebase);
    if (round === MAX_REBASE_ROUNDS) {
      throw new Error(
        `The target branch kept moving; still behind after ${MAX_REBASE_ROUNDS} rebase rounds: ${toRebase
          .map((pr) => `#${pr.number}`)
          .join(", ")}`,
      );
    }

    for (const pr of toRebase) {
      process.stdout.write(`Rebasing ${options.repository}#${pr.number}...\n`);
      gh.run([
        "pr",
        "update-branch",
        String(pr.number),
        "--repo",
        options.repository,
        "--rebase",
      ]);
      rebased.add(pr.number);
    }
  }

  const queued = [];
  const alreadyQueued = [...existingEntries.keys()];
  for (const pr of pendingCandidates) {
    try {
      const existing = getQueueEntry(gh, pr.id);
      if (existing) {
        alreadyQueued.push(pr.number);
        continue;
      }

      process.stdout.write(`Queueing ${options.repository}#${pr.number}...\n`);
      enqueuePullRequest(gh, pr);
      queued.push(pr.number);
    } catch (error) {
      writeSummary([
        ...summary,
        "",
        "### Partial queue result",
        "",
        `Newly queued before failure: ${
          queued.length > 0
            ? queued.map((number) => `#${number}`).join(", ")
            : "none"
        }.`,
        `Already queued: ${
          alreadyQueued.length > 0
            ? alreadyQueued.map((number) => `#${number}`).join(", ")
            : "none"
        }.`,
        `Failed while queueing #${pr.number}: ${error.message}`,
        "Rerun the same batch safely; existing queue entries are detected and skipped.",
      ]);
      throw new Error(
        `Queueing stopped at #${pr.number} after ${queued.length} new entries: ${error.message}`,
      );
    }
  }

  writeSummary([
    ...summary,
    "",
    `Prepared and submitted to the merge queue: ${queued
      .map((number) => `#${number}`)
      .join(", ")}. Rebased because they were behind: ${
      rebased.size > 0
        ? [...rebased].map((number) => `#${number}`).join(", ")
        : "none (all were current)"
    }.`,
    ...(alreadyQueued.length > 0
      ? [
          `Already in the queue and left in place: ${alreadyQueued
            .map((number) => `#${number}`)
            .join(", ")}.`,
        ]
      : []),
  ]);

  return {
    candidates,
    queued,
    alreadyQueued,
    rebased: [...rebased],
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await runBatch(options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
