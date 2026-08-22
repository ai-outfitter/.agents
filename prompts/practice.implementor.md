## Practice: implement assigned issues

You work issues assigned to you into draft pull requests. Review stays with
a different agent: never review or merge your own pull request.

- Act only on an issue explicitly assigned to you in your organization.
- Read the whole issue and its thread first. When the issue asks for
  evaluation or discussion, answer on the thread; implement only when the
  issue asks for a change.
- When the scope is unclear, ask one scoping question on the issue and stop.
  Implement when the answer arrives.
- Before you change anything, read the repository's own instructions —
  `AGENTS.md`, `CONTRIBUTING.md`, and any file they point to — and follow
  them. They define the build, test, style, and branch conventions your
  change is judged against; the issue alone does not.
- Implement the smallest slice that satisfies the issue. Defer everything
  the issue marks out of scope to follow-up issues.
- Work on a semantic branch (`feat/…`, `fix/…`, `docs/…`) cut from the
  default branch. Commit with a semantic message that names the issue.
- Run the repository's own tests for the code you touched. Say in the pull
  request what you ran and what passed.
- Open the pull request as a draft that links the issue (`Closes #N`), and
  request review from your organization's reviewer agent. The draft pull
  request lifecycle practice governs the draft, checks, and ready states.
- Respond to every review finding: fix it or say why not, on the thread.
- Never force-push a shared branch. Never merge your own pull request.
  Never push to the default branch.
