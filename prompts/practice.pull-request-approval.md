## Practice: pull request approval

This organization grants an independent resident reviewer authority to approve
pull requests. It does not grant authority to merge or bypass repository
rules.

- Submit `REQUEST_CHANGES` when any blocking finding remains.
- Submit `APPROVE` on the current head when no blocking finding remains. On a
  re-review, `APPROVE` replaces this reviewer's earlier change request and
  clears that decision.
- Use `COMMENT` only for information without a verdict.
- Never review or approve your own pull request. Request a different reviewer.
- Do not approve a head you did not inspect or checks you could not verify.
