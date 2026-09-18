---
name: wp-client-queries-file-and-followup
description: Use when the user wants to file client responses and chase what's still outstanding on a binder or client group — "file the client's reply and follow up", "process this email and update the queries", "chase the outstanding queries", "check for replies and remind whoever hasn't answered". Files one open email or scans for everything unfiled, advances the matching queries, then optionally drafts a follow-up. Schedulable.
kind: recipe
---

# wp-client-queries-file-and-followup — File & Follow-up

**Sequence:** `wp-binder-resolve` → `wp-intake-discover` (anchor `thread` | `queries`) → `wp-intake-file`
→ `wp-client-queries-query-advance` → *(optional)* `wp-client-queries-query-status-review` →
`wp-client-queries-query-compile`.
Index: `wp-ref-recipes`; conventions:
`wp-ref-conventions`.

The **only** recipe that reaches into the inbox. File client responses, advance the queries they
answer, then — optionally — draft a follow-up for whatever's still outstanding. It never re-derives gaps
from the trial balance (that's `wp-client-queries-initial-request`) and never raises new queries.

## Orchestration

1. **Resolve** — `wp-binder-resolve` → `BinderContext`(s) (job-type scope per
   the *Job-type scope for wp-binder-resolve* section of `wp-ref-recipes`). Group scope →
   every open binder in the group (within that scope), swept per binder, one consolidated report.
2. **File the response(s) — input switch (subagent scan via `subagent_type: wp-discover`; inline file + epilogue):**
   - **Single open email** (an agent invoked from an open message, or the user points at one reply) →
     `wp-intake-discover` on the **`thread`** anchor: read the thread and map its attachments to
     `FilingCandidate[]` tagged `relatedQueryId`.
   - **Scan for everything unfiled** ("catch up the replies", periodic sweep) → `wp-intake-discover` on
     the **`queries`** anchor: enumerate `Sent`/`InProgress` queries, scan inbound channels for replies
     that were never filed, judge `alreadyFiled` **on the query** (not the document), and tag each
     unfiled reply `relatedQueryId`.
   Then `wp-intake-file` files the candidates (idempotent by `documentId`) and
   `wp-client-queries-query-advance` posts the client's answer on each matched query and advances its
   status (`InProgress`/`Resolved`). All writes batch behind one confirmation.
3. **Follow up (optional — file-only is a valid stop).** When the user wants to chase (or on a scheduled
   sweep), for queries still `Sent`/`InProgress` after step 2 with no inbound reply:
   - Enumerate with `active-workpapers-matters-search kind=ClientQuery outstanding=true
     previewChars=0`, age-filtered server-side via `createdTo`/`editedTo`
     (= now − threshold; default `Sent` >14 days) — S3. `Resolved`/`Actioned` are terminal, never
     chased. Hand this list to the next two steps (fetch once, thread forward).
   - Look back at each query's history (`active-workpapers-matters-messages-list limit=20`) — when sent, prior reminders,
     partial answers; escalate tone with reminder count.
   - **Reconcile statuses first** — `wp-client-queries-query-status-review` (batched tables, over the
     queries' own recorded state only) so any query whose answer step 2 already filed but didn't fully
     close drops out of the chase (→ `Resolved`) and none of the outstanding items are chased for
     something already on record. Step 2's `query-advance` handles the replies just filed; this catches
     anything reconciled from prior state.
   - Draft the reminders via **`wp-client-queries-query-compile`** in **follow-up flavour** (one
     consolidated reminder per client listing the outstanding items with the original ask + days
     outstanding). Its outward gate applies — when the channel is email and a draft-capable mail
     engine is connected (`outlook-email.draft` + the firm's `emailDraft` preference) it offers to
     drop the reminder into the user's mailbox as a draft, else shows it inline; sending stays the
     user's action (no send tool in this environment —
     `wp-ref-sources`); on confirmed send, one `active-workpapers-matters-apply`
     posts a short "followed up …" line per chased query (with an email link where applicable);
     status stays `Sent`/`InProgress` — a reminder is not a state change.
4. **Report** — per binder: replies filed defer to the filer's recap
   (`wp-ref-conventions` — post-filing recap; note only already-filed /
   none-found here), plus **queries advanced**, **reminders drafted**, and the **ageing line** for
   anything still outstanding (title, linked accounts, days outstanding, reminders sent) — the report
   inherited from the retired skill 8.

## Notes

- Step 2's scan/thread-read is the subagent leg (the `queries` / `thread` discover, dispatched to the
  `wp-discover` agent via `subagent_type: wp-discover`); filing, the query epilogue, and the outward
  reminder stay inline behind their gates.
- **Schedulable.** Safe to run repeatedly: filing is idempotent by `documentId`, the query epilogue only
  advances statuses, and follow-up escalates rather than re-sends. When run unattended, stop at the
  confirmation gates and leave the batches + drafts for the user
  (`wp-ref-conventions` — writes always confirm).
- On a group scope, run per binder and consolidate the report.
