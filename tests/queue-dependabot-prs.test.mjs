import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  automaticRebaseBlocker,
  classifyRequiredChecks,
  isMergeabilityPending,
  needsAnotherRebase,
  parseOptions,
  parsePullRequestNumbers,
  runBatch,
  selectCandidates,
  validateCandidate,
  validateRepository,
} from "../.github/scripts/queue-dependabot-prs.mjs";

const dependabotPr = {
  author: { login: "dependabot[bot]" },
  baseRefName: "main",
  headRefOid: "abc123",
  id: "PR_12",
  isDraft: false,
  mergeStateStatus: "CLEAN",
  mergeable: "MERGEABLE",
  number: 12,
  state: "OPEN",
  title: "Bump dependency",
  url: "https://github.com/ai-outfitter/outfitter/pull/12",
};

test("parses ordered, unique PR numbers", () => {
  assert.deepEqual(parsePullRequestNumbers("#12, 9 12"), [12, 9]);
  assert.deepEqual(parsePullRequestNumbers(""), []);
  assert.throws(() => parsePullRequestNumbers("12,nope"), /Invalid pull/);
});

test("restricts targets to the ai-outfitter organization", () => {
  assert.doesNotThrow(() => validateRepository("ai-outfitter/outfitter"));
  assert.throws(() => validateRepository("other/outfitter"), /ai-outfitter/);
  assert.throws(
    () => validateRepository("ai-outfitter/out fitter"),
    /owner\/name/,
  );
});

test("validates candidate identity, base, state, and draft status", () => {
  assert.deepEqual(validateCandidate(dependabotPr, "main"), []);
  assert.deepEqual(
    validateCandidate(
      { ...dependabotPr, author: { login: "app/dependabot" } },
      "main",
    ),
    [],
  );
  assert.deepEqual(
    validateCandidate(
      {
        ...dependabotPr,
        author: { login: "human" },
        baseRefName: "next",
        isDraft: true,
        state: "CLOSED",
      },
      "main",
    ),
    [
      "state is CLOSED",
      "author is human",
      "base is next, not main",
      "pull request is a draft",
    ],
  );
});

test("classifies mergeability states conservatively", () => {
  assert.equal(automaticRebaseBlocker(dependabotPr), null);
  assert.match(
    automaticRebaseBlocker({ ...dependabotPr, mergeStateStatus: "DIRTY" }),
    /conflicts/,
  );
  assert.equal(
    automaticRebaseBlocker({ ...dependabotPr, mergeable: "CONFLICTING" }),
    "has merge conflicts that an automatic rebase cannot resolve",
  );
  assert.equal(
    needsAnotherRebase({ ...dependabotPr, mergeStateStatus: "BEHIND" }),
    true,
  );
  assert.equal(isMergeabilityPending(dependabotPr), false);
  assert.equal(
    isMergeabilityPending({ ...dependabotPr, mergeable: "UNKNOWN" }),
    true,
  );
});

test("classifies required checks before direct queue insertion", () => {
  assert.equal(classifyRequiredChecks([]).state, "missing");
  assert.equal(
    classifyRequiredChecks([{ bucket: "pending", name: "CI" }]).state,
    "pending",
  );
  assert.equal(
    classifyRequiredChecks([{ bucket: "fail", name: "CI" }]).state,
    "failed",
  );
  assert.equal(
    classifyRequiredChecks([{ bucket: "pass", name: "CI" }]).state,
    "passed",
  );
});

test("preserves explicit PR order and rejects an ineligible selection", () => {
  const pulls = new Map([
    [12, dependabotPr],
    [9, { ...dependabotPr, id: "PR_9", number: 9 }],
    [
      8,
      {
        ...dependabotPr,
        author: { login: "human" },
        id: "PR_8",
        number: 8,
      },
    ],
  ]);
  const gh = {
    json(args) {
      return pulls.get(Number(args[2]));
    },
  };

  assert.deepEqual(
    selectCandidates({
      gh,
      repository: "ai-outfitter/outfitter",
      baseBranch: "main",
      requestedNumbers: [12, 9],
    }).map((pr) => pr.number),
    [12, 9],
  );

  assert.throws(
    () =>
      selectCandidates({
        gh,
        repository: "ai-outfitter/outfitter",
        baseBranch: "main",
        requestedNumbers: [8],
      }),
    /author is human/,
  );
});

test("reads workflow environment and lets CLI flags override it", () => {
  assert.deepEqual(
    parseOptions(["--repository", "ai-outfitter/actions", "--execute"], {
      TARGET_REPOSITORY: "ai-outfitter/outfitter",
      PULL_REQUESTS: "12,9",
      EXECUTE: "false",
    }),
    {
      repository: "ai-outfitter/actions",
      pullRequests: "12,9",
      execute: true,
      timeoutSeconds: 300,
      pollSeconds: 10,
    },
  );
});

class FakeGitHubCli {
  constructor(pulls, { existingQueueIds = [], failEnqueueId = null } = {}) {
    this.pulls = pulls;
    this.calls = [];
    this.existingQueueIds = new Set(existingQueueIds);
    this.failEnqueueId = failEnqueueId;
  }

  run(args) {
    this.calls.push(args);
    if (args[0] === "repo" && args[1] === "view") return "main";
    if (args[0] === "pr" && args[1] === "update-branch") {
      const number = Number(args[2]);
      this.pulls.set(number, {
        ...this.pulls.get(number),
        headRefOid: `${this.pulls.get(number).headRefOid}-rebased`,
        mergeStateStatus: "CLEAN",
      });
    }
    return "";
  }

  result(args) {
    this.calls.push(args);
    if (args[0] === "pr" && args[1] === "checks") {
      return {
        status: 0,
        stderr: "",
        stdout: JSON.stringify([
          { bucket: "pass", name: "CI", state: "SUCCESS", workflow: "CI" },
        ]),
      };
    }
    throw new Error(`Unexpected fake gh result call: ${args.join(" ")}`);
  }

  json(args) {
    this.calls.push(args);
    if (args[0] === "api") {
      const query = args.find((part) => part.startsWith("query=")) ?? "";
      const id = (args.find((part) => part.startsWith("id=")) ?? "").slice(3);
      const pullRequestId = (
        args.find((part) => part.startsWith("pullRequestId=")) ?? ""
      ).slice("pullRequestId=".length);

      if (query.includes("enqueuePullRequest")) {
        if (pullRequestId === this.failEnqueueId) {
          throw new Error(`simulated enqueue failure for ${pullRequestId}`);
        }
        this.existingQueueIds.add(pullRequestId);
        return {
          data: {
            enqueuePullRequest: {
              mergeQueueEntry: {
                id: `MQE_${pullRequestId}`,
                position: this.existingQueueIds.size,
              },
            },
          },
        };
      }
      if (query.includes("mergeQueueEntry")) {
        return {
          data: {
            node: {
              mergeQueueEntry: this.existingQueueIds.has(id)
                ? { id: `MQE_${id}`, position: 1 }
                : null,
            },
          },
        };
      }
      return {
        data: {
          repository: {
            autoMergeAllowed: true,
            mergeQueue: { id: "MQ_test" },
          },
        },
      };
    }
    if (args[0] === "pr" && args[1] === "list") {
      return [...this.pulls.values()];
    }
    if (args[0] === "pr" && args[1] === "view") {
      return this.pulls.get(Number(args[2]));
    }
    throw new Error(`Unexpected fake gh call: ${args.join(" ")}`);
  }
}

const executeOptions = {
  repository: "ai-outfitter/outfitter",
  pullRequests: "",
  execute: true,
  timeoutSeconds: 1,
  pollSeconds: 0.001,
};

test("rebases the entire behind batch before queueing in FIFO order", async () => {
  const pulls = new Map([
    [12, { ...dependabotPr, mergeStateStatus: "BEHIND" }],
    [
      9,
      {
        ...dependabotPr,
        headRefOid: "def456",
        id: "PR_9",
        mergeStateStatus: "BEHIND",
        number: 9,
      },
    ],
  ]);
  const gh = new FakeGitHubCli(pulls);

  const result = await runBatch(executeOptions, {
    gh,
    sleep: async () => {},
  });

  assert.deepEqual(result.queued, [9, 12]);
  assert.deepEqual(result.rebased, [9, 12]);
  const rebases = gh.calls.filter(
    (args) => args[0] === "pr" && args[1] === "update-branch",
  );
  assert.deepEqual(
    rebases.map((args) => args.slice(0, 3)),
    [
      ["pr", "update-branch", "9"],
      ["pr", "update-branch", "12"],
    ],
  );
  const enqueues = gh.calls.filter((args) =>
    args.some((part) => part.includes("enqueuePullRequest")),
  );
  assert.deepEqual(
    enqueues.map((args) =>
      args.find((part) => part.startsWith("pullRequestId=")),
    ),
    ["pullRequestId=PR_9", "pullRequestId=PR_12"],
  );
  assert.deepEqual(
    enqueues.map((args) =>
      args.find((part) => part.startsWith("expectedHeadOid=")),
    ),
    ["expectedHeadOid=def456-rebased", "expectedHeadOid=abc123-rebased"],
  );
});

test("fails closed before rebasing when any selected PR conflicts", async () => {
  const pulls = new Map([
    [12, dependabotPr],
    [
      9,
      {
        ...dependabotPr,
        id: "PR_9",
        mergeStateStatus: "DIRTY",
        number: 9,
      },
    ],
  ]);
  const gh = new FakeGitHubCli(pulls);

  await assert.rejects(
    runBatch(executeOptions, { gh, sleep: async () => {} }),
    /No pull requests were rebased or queued/,
  );
  assert.equal(
    gh.calls.some((args) => args[0] === "pr" && args[1] === "update-branch"),
    false,
  );
  assert.equal(
    gh.calls.some((args) =>
      args.some((part) => part.includes("enqueuePullRequest")),
    ),
    false,
  );
});

test("reports a partial queue and supports an idempotent rerun", async () => {
  const pulls = new Map([
    [12, dependabotPr],
    [9, { ...dependabotPr, headRefOid: "def456", id: "PR_9", number: 9 }],
  ]);
  const gh = new FakeGitHubCli(pulls, { failEnqueueId: "PR_12" });
  const tempDirectory = mkdtempSync(join(tmpdir(), "dependabot-queue-test-"));
  const summaryPath = join(tempDirectory, "summary.md");
  const previousSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  process.env.GITHUB_STEP_SUMMARY = summaryPath;

  try {
    await assert.rejects(
      runBatch(executeOptions, { gh, sleep: async () => {} }),
      /Queueing stopped at #12 after 1 new entries/,
    );
    const summary = readFileSync(summaryPath, "utf8");
    assert.match(summary, /Newly queued before failure: #9/);
    assert.match(summary, /Failed while queueing #12/);

    gh.failEnqueueId = null;
    const rerun = await runBatch(executeOptions, {
      gh,
      sleep: async () => {},
    });
    assert.deepEqual(rerun.alreadyQueued, [9]);
    assert.deepEqual(rerun.queued, [12]);
  } finally {
    if (previousSummaryPath === undefined) {
      delete process.env.GITHUB_STEP_SUMMARY;
    } else {
      process.env.GITHUB_STEP_SUMMARY = previousSummaryPath;
    }
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
