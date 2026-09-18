---
name: wp-client-queries-query-advance
description: Building block for the client-queries recipes; the query-lifecycle epilogue — for filed candidates that answer an open query, post the client's answer on the query and advance its status. Invoke directly only with pre-matched candidates already filed.
kind: skill
user-invocable: false
---

# wp-client-queries-query-advance — advance the queries a reply answered

The **query-lifecycle epilogue**, and the *only* place it happens. Given candidates that answer an open
query (tagged `relatedQueryId` by `wp-intake-discover`) and already filed by `wp-intake-file`, post the
client's answer on each matched query and advance its status. Discovery does the reading and matching;
filing does the document writes; this skill owns only the query side, so the canonical filer can stay
query-blind and be reused by areas with no client queries.

**Inputs:** pre-matched `FilingCandidate[]` carrying `relatedQueryId` **plus** the `FiledArtifact[]`
`wp-intake-file` produced (for the `documentId`/`recordId` links) and `BinderContext`; the answering
prose from the reply when discovery captured it. **Output:** query status/message updates (rolled into
`FiledArtifact[]` reporting). **Side-effects: writes** (query messages/status) →
**batch-confirm** (`wp-ref-conventions`).

## Procedure

1. **Group by query.** Collect the filed candidates by `relatedQueryId`; fetch every matched query in
   **one** `active-workpapers-matters-get ids=[…]` and, where useful, a query's recent history
   (`active-workpapers-matters-messages-list limit=20`) so a partial answer builds on what's already
   recorded rather than repeating it.
2. **Confirm, then apply with ONE `active-workpapers-matters-apply`.** One `updates[]` entry per matched
   query carrying the whole epilogue atomically:
   - `post` — the client's answer (a quote or faithful summary). Attach each filed document via
     `postDocuments` (a `MeDocumentRef` `{ documentId, name }`) on the same update — message
     hyperlinks are the query↔*document* linkage. One update per query carries the whole epilogue
     (status change + answer + all its document attachments together).
   - `status` — `InProgress` when partially answered, `Resolved` when the ask is fully satisfied.
     **Never regress, never touch `Actioned`.**
   - `workpaperRecordId` — re-link the query to the record the reply was filed to (a query links a
     **single** record; this re-points it, there is no un-link transition).
3. **Report** per query: what was filed where (from the `FiledArtifact[]`), what was answered in prose,
   and the status change (from the acks). Anything in a reply that answered *no* open query is
   discovery's business — it should already carry a home (or be flagged), not surface here.

## Notes

- **Idempotent.** Re-running is safe: filing is idempotent by `documentId` (handled upstream), and this
  skill only advances status forward and appends an answer message — dedup a re-post against the query's
  existing hyperlinks before posting.
- **Not a search skill.** It never reads the inbox or matches replies — that moved to
  `wp-intake-discover` (`thread` / `queries` anchors). It runs inline behind the confirmation gate; no
  subagent leg.
