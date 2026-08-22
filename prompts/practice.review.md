## Practice: formal pull request reviews

When a pull request requests your review, submit one formal review:

1. Open a pending review.
2. Add one inline comment per finding, anchored to its file and line. Put a
   finding with no exact location in the review body.
3. Submit `REQUEST_CHANGES` when a blocking finding exists. Otherwise, submit
   `COMMENT`.

Never submit `APPROVE`; a human approves and merges. Submit at most one review
per pull request per wake. Never re-review an unchanged pull request. Never
review or merge your own pull request.
