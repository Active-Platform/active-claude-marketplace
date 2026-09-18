---
name: wp-client-queries-compile
description: Use when the user wants the binder's (or group's) already-recorded client queries turned into output — "send the query list to the client", "compile the outstanding queries into a letter", "draft the information request from what's recorded", or "just show me what's outstanding as a table". Correspondence by default; table/other format on request; marks queries sent only on confirmation.
kind: recipe
---

# wp-client-queries-compile — Draft Queries

**Sequence:** `wp-binder-resolve` → `wp-client-queries-query-status-review` →
`wp-client-queries-query-compile`.
Index: `wp-ref-recipes`.

Take the queries **already recorded** on the binder (or group) and produce output from them. This
recipe records nothing new — if the user wants gaps *identified* from scratch, that's
`wp-client-queries-initial-request`; if they want client *replies* filed, that's
`wp-client-queries-file-and-followup`. **Never scans the inbox** — it reasons over the binder's own
query records only.

Resolve → reconcile statuses → compile, one optional tail write:

## Orchestration (all inline)

1. **Resolve** — `wp-binder-resolve` **with the default `anticipate-new-binders: false`** (existing
   binders only) → `BinderContext` (job-type scope per
   the *Job-type scope for wp-binder-resolve* section of `wp-ref-recipes`), or group
   scope: one document covering the group's related entities, each query's entity marked or
   grouped per the `grouping` preference. Compile turns **already-recorded** queries into output, so
   a binder that doesn't exist yet has nothing to compile — an entity with only a Completed prior-year
   binder (no binder in the anchor year) is reported as out-of-scope FYI, **never** offered as a
   read-only prior-year basis. Anticipating this year's questions from last year's template is
   `wp-client-queries-initial-request`'s job (named in the "Nothing to compile" fallback below), and
   it is the recipe that passes `anticipate-new-binders: true`.
2. **Reconcile statuses — run `wp-client-queries-query-status-review` inline; present its tables.**
   This step **always runs here**; never exclude not-ready queries yourself and defer the user to
   run reconciliation separately. Read-only over each query's own recorded state (status vs the
   messages / documents already on each query — **never the inbox**), it proposes two normalisations
   as **batched tables** (one confirmation each, trimmable):
   - **Resolved table** — queries with an answer already on record → `Resolved`, each row **quoting
     the evidence** (the recorded client response, with a *Why* column) that justifies it.
   - **ReadyToSend table** — **every** not-ready `Created`/`InProgress` query is surfaced for the
     **user** to decide promotion (no *Why* column; the agent never pre-excludes any).

   Applied only on the user's confirmation; a declined batch (or rows the user trims) is left as-is.
   Hand the reconciled query set to step 3.
3. **Compile** — `wp-client-queries-query-compile` drafts the output:
   - **Format** — default **correspondence** (email/letter, house style per the firm's `channel`
     preference — `wp-ref-query-preferences`);
     on request a **table** or other format. **Table output is read-only** — it lists the
     outstanding queries and stops, making no writes (this is the fast "what's still outstanding?"
     snapshot; there is no separate status recipe).
   - **Wording** — adapts to the query mix: **fresh** (all new — a first ask), **follow-up** (all
     previously `Sent` — a reminder of still-outstanding items), or **mixed** (both, with new vs
     previously-requested visibly flagged).
   - Optional caller filters: query-id filter, `newOnly` (exclude previously-sent items).
4. **Mark as sent (optional — the main write)** — the outward gate. The document is always
   confirmed first; when the channel is email and a draft-capable mail engine is connected
   (`outlook-email.draft` + the firm's `emailDraft` preference), the compile step first offers to
   drop the request into the user's mailbox as a draft — otherwise it's shown inline; either way
   sending stays the user's action (no send tool in this environment —
   `wp-ref-sources`). On the user's confirmation, one
   `active-workpapers-matters-apply` marks every included query `Sent` and posts a short "sent …" line to
   each; queries already `Sent` keep that status and get a "followed up …" line instead (with an
   email link where applicable). If **every** included query is already `Sent`, the prompt says only
   a follow-up line will be recorded — there is no status to change. Per-tier detail lives in
   `wp-client-queries-query-compile`. Table/snapshot runs never reach this step.
5. **Report** — the output, plus per-query outcome: which queries are now `Sent` (or, when all were
   already `Sent`, that a follow-up line was recorded with no status change), and any status
   normalisation applied at step 2.

Nothing to compile (no outstanding queries)? Say so and suggest `wp-client-queries-initial-request`
(to identify gaps) or `wp-client-queries-file-and-followup` (to file replies first).
