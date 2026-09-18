---
name: wp-client-queries-query-status-review
description: Building block for the client-queries recipes; before drafting, reconcile the recorded status of a binder's (or group's) open queries against their own recorded evidence — promote not-ready items to ReadyToSend and mark looks-answered items Resolved, in two batched tables. Invoke directly only for a standalone status tidy-up; recipes chain it before query-compile.
kind: skill
user-invocable: false
---

# wp-client-queries-query-status-review — reconcile query statuses before drafting

Reconcile the **recorded status** of a binder's (or group's) open queries against **their own
recorded evidence**, *before* anything is drafted. Two normalisations only — promote not-ready
queries to `ReadyToSend`, and mark queries whose answer is already on record `Resolved`. Presented as
**two batched tables**, one confirmation each. Drafting the outbound document is
`wp-client-queries-query-compile`'s job; hunting the inbox for replies is
`wp-client-queries-file-and-followup`'s (R3) — **this skill never reads the inbox.**

**Inputs:** `BinderContext` (or group scope), optional query-id filter, optional caller-supplied
query list (so a caller that already fetched the open queries — e.g. a recipe — needn't refetch).
**Output:** the applied status transitions + the reconciled open-query set (handed on to
`wp-client-queries-query-compile`). **Side-effects: writes** (status normalisation only) →
**batch-confirm** (`wp-ref-conventions`); **not** outward-facing.

Query lifecycle is `Created | ReadyToSend | Sent | InProgress | Resolved | Actioned`
(`wp-ref-conventions`).

## Procedure

1. **Collect — the open queries.** Reuse a caller-supplied list instead of refetching when given
   (conventions.md — fetch once, thread forward); else `active-workpapers-matters-search
   kind=ClientQuery outstanding=true` (apply the caller's id filter; keep the
   default `conversationPreview` — step 2 classifies from it). For **group scope**, pass every group
   binder as `binderId: [...]` in **one** call (not per-binder); the result is **flat** — each row
   carries its `binderId`, so group the `records` by `binderId` client-side and use each binder's
   name as the entity the tables mark. List items already carry the derived `account` /
   `section` (via the query's linked record), `status`, and `conversationPreview` — classify without
   refetching each query.
2. **Classify — over each query's own recorded state only.** Look at status plus the query's own
   `conversationPreview` / message count / linked documents & records — **never the inbox**:
   - **→ Resolved batch** — any open query (usually `Sent`/`InProgress`) with **any** answer
     signal on its own record — an inbound **client answer** in the messages, or a weaker signal
     such as a linked document — that was never moved to `Resolved`. Propose it on any signal, but
     **capture the specific evidence** for each: when the `conversationPreview` doesn't already
     contain the client's answer text, read the matter thread (`active-workpapers-matters-messages-list`
     for that query) so you can **quote** it — the flag must be grounded, not a guess. A weak/ambiguous
     signal is still proposed, flagged **lower-confidence**, quoting whatever exists.
   - **→ ReadyToSend batch** — **every** open `Created` (not started) / `InProgress` (in progress)
     query with **no** answer signal. Present them **all** — do **not** pre-filter to the ones you
     judge "vetted enough" or "ready"; **promoting to `ReadyToSend` is the user's decision, not
     yours.** Never silently omit a not-ready query the user would want to see.
   - **Leave alone** — `ReadyToSend` and `Sent` with no answer signal (nothing to do);
     `Resolved` / `Actioned` (terminal — never touch). An `InProgress` query with an answer on
     record goes to the Resolved batch, not ReadyToSend.
3. **Present — two batched tables, one confirmation each, trimmable.** Never prompt per query —
   the table *is* the per-query visibility. For each non-empty batch, show its table, then ask once:
   *"apply these transitions?"* — and make clear the user may **approve the whole batch or name rows
   to leave out** (nothing is applied the user didn't agree to; nothing is silently omitted).
   Order the two asks: Resolved batch first (closing answered items), then ReadyToSend. Skip an
   empty batch; if both are empty, report "nothing to reconcile" and return.
   - **Resolved table** — columns **title · description (only if the query has one) · linked
     account/section · current status · Why (evidence)**. The *Why* cell **quotes the recorded
     client response** — a short quote plus its date/sender — that justifies resolving; for a weak
     signal, name the signal and mark it **lower-confidence**. Never leave *Why* blank — if there
     is nothing to quote, it does not belong in this batch.
   - **ReadyToSend table** — columns **title · description (only if the query has one) · linked
     account/section · current status**. **No "Why" column** — promotion is the user's judgment
     call, not something this skill justifies.
   - Add an **entity** column on group / multi-entity scope. The **description** column is
     conditional: show it only when at least one query in the table has a non-null `description`
     (fetch detail via `active-workpapers-matters-get` when you need it — list rows don't carry it); the
     **title** is always shown. Never invent a description that isn't recorded.
4. **On confirmation — apply with ONE `active-workpapers-matters-apply` and report.** Both confirmed
   batches go in a single call: one `updates[]` entry per query — `status` plus a `post` carrying a
   short provenance note where it helps. For a Resolved item **reuse the same evidence** shown in
   the table ("Marked Resolved — client answer recorded 7 Jul 2026: '…'"); for a promotion,
   "Promoted to Ready to Send" — atomic transition+note per query, all-or-nothing across the batch.
   Report what changed and what was left as-is (from the acks, including any rows the user trimmed),
   and hand the reconciled open-query set to the caller.

## Notes

- **Pure status reconciliation.** It creates no queries (that's `wp-client-queries-query-record`),
  drafts nothing (`wp-client-queries-query-compile`), and reads no inbox
  (`wp-client-queries-file-and-followup`). It only moves statuses that the query's own record already
  justifies.
- **A declined batch changes nothing** — those queries keep their current status and flow into
  compile as-is (compile still won't silently include a not-ready item).
- Skill, not agent: bounded writes behind (at most) two confirmations; reasons over already-listed
  query rows, so it stays inline and visible.
