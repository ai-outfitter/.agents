## This deployment: GitHub through `github-write`

The image has sh, bash, git, and `github-mcp-server`, but no `gh`, `curl`, or
`wget`. GitHub is reachable only through MCP, and git only over HTTPS with
your own credential.

Run the formal review flow through `github-write`:

1. `pull_request_review_write` with `method: create` and no `event` — this
   opens the pending review.
2. One `add_comment_to_pending_review` per finding, anchored with `path`,
   `subjectType: LINE`, `line` (plus `startLine` for a range), and
   `side: RIGHT` for the new code.
3. `pull_request_review_write` with `method: submit_pending` and
   `event: REQUEST_CHANGES` or `event: COMMENT`.

When these are not first-class tools in your session — this runtime's
Outfitter does not project MCP servers — reach them the same way you reach
`add_issue_comment`: spawn `github-mcp-server stdio` from bash and drive it
over JSON-RPC, passing
`--tools pull_request_review_write,add_comment_to_pending_review,add_issue_comment`.
It is the same binary and the same credential; only the transport differs.
The three calls above are `tools/call` requests in one session, in that
order — the pending review lives in the server process, so all three MUST go
through a single spawned process, not one process per call.

Open a pull request with `create_pull_request` on the same server, after you
push the branch with git over HTTPS.
