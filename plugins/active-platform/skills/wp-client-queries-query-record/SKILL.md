---
name: wp-client-queries-query-record
description: Building block for the client-queries recipes; turn unsatisfied information needs into ClientQuery domain objects recorded on the binder, deduping against open queries.
kind: skill
user-invocable: false
---

# wp-client-queries-query-record — record the queries in the system

Turn unsatisfied needs into **`ClientQuery` domain objects recorded on the binder** in
Workpapers — actual system records (matters), not a document. Drafting the outbound client
document is `wp-client-queries-query-compile`'s job, not this skill's.

**Inputs:** the unsatisfied `InformationNeed[]` — the `not-found`/`partial` subset of
`MatchResult[]` when a search ran, or directly the `missing`/`partially-held` needs from
`wp-client-queries-info-needs` when it didn't (e.g. in Client Close) — plus `BinderContext`
and the existing open queries. **Output:** `RecordedQuery[]`
(`wp-ref-contracts`).
**Side-effects: writes** (query matters) → **batch-confirm**
(`wp-ref-conventions`).

## Procedure

1. **Dedup first.** Use the caller-supplied open-query list when the recipe already fetched it
   (conventions.md — fetch once, thread forward); else
   `active-workpapers-matters-search kind=ClientQuery outstanding=true previewChars=0`
   (scoped to `binderId: [...]`). For each gap:
   - An open query already covering the same gap → **reuse it**: plan an update only if the
     scope changed (e.g. widen the period, add an account); otherwise no write, emit
     `reusedExisting: true`. Match on **same account(s) + same evidence ask**; for an
     account-less (`expected-absent`) need, match on **same section(s) + same evidence ask**
     instead.
   - Needs arriving with `status:"requested"` / `existingQueryId` are reuse by definition.
   - The same gap must never spawn a second query.
2. **Draft each new query as a matter:**
   - `title` — short, account-anchored ("FY2026 bank statements — Payroll Account"). For an
     account-less `expected-absent` need, fall back to section/topic-anchored ("FY2026 —
     acquisition contracts & completion accounts"). Any parenthetical names the *topic*, not
     necessarily an existing section — link the section the account will land in when created
     (often a general/lead section), not a same-named one you expect to find. Plain text, ≤128
     characters.
   - `description` (the query **body**) — a clear, client-facing question: what
     document/information, which period, why it's needed. For `partial` needs, acknowledge what's
     already held and ask for the remainder. Quote `priorPeriodPrecedent` phrasing where set ("as
     provided last year"). For a `flaggedActivity` need, frame it from the flagged activity ("you
     mentioned acquiring …"). For a `provenance:"hybrid"` need (e.g. construction WIP), keep the ask
     **open-ended** — "supply any information you have to help us calculate …" — rather than naming
     a specific document.
     **This field is the query.** `query-compile` renders the client's letter/email from
     `description`, so an ask left out of it reaches the client as an empty request. A create takes
     no conversation message — there is nowhere else for the ask to go.
     **Rich text, not markdown** — `<strong>` `<em>` `<u>` `<ul>`/`<ol>`/`<li>` `<a href>` (https)
     `<br>` `<div>` `<span>` only; `**bold**`, `<p>` and headings are stripped silently on save, so
     the client sees literal asterisks or lost structure with no error raised. Paragraphs are
     `<div>`. ≤4000 visible characters (markup itself doesn't count).
   - **Linkage** — a query links a **single** workpaper record (`workpaperRecordId`), not
     account/record/section arrays. When the need's scope carries an existing `recordId`, set
     `workpaperRecordId` on the create. Otherwise, for an account- or section-scoped need, link
     after the create with **one `active-workpapers-binders-attach`** (`sourceAccountId` **or**
     `sectionId` + the new `matterId`) — the tool resolves or creates the record on that parent and
     sets the query's `workpaperRecordId`. Leave a purely account-less need unlinked.
   - `status` — `Created` (default) or `ReadyToSend` when the caller says compilation is
     imminent.
   - `attentionOfUserId` — default from `BinderContext.team` (preparer for evidence-chasing,
     manager where judgement is implied).
3. **Confirm the batch.** One table: title → linked account/section → new vs reused → status. One
   confirmation, then apply with **one `active-workpapers-matters-apply`** — `creates[]` (kind=`ClientQuery`)
   for the new queries, `updates[]` for the scope-changed reuses; all-or-nothing, acks back. Then
   one `active-workpapers-binders-attach` per account/section-scoped query to link its record.
4. **Emit `RecordedQuery[]`** with the server-assigned `matterId`s.

## Notes

- Group related small gaps into one query when they'd read as one ask to the client (e.g. all
  five missing bank statements → one query listing the accounts in its `description`). The query
  still links a **single** record (or none) — name every affected account in the description, not
  in a link. A `<ul>`/`<li>` list is the right shape for such a grouped ask.
- Skill, not agent: bounded writes behind one confirmation.
