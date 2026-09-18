---
name: wp-ref-recipes
description: Reference — the wp-* Workpapers recipe index (recipe → skill sequence per area) plus the job-type, job-type-family and financial-year scope rules for wp-binder-resolve. Loaded by wp-* skills via the Skill tool; not a standalone task.
kind: skill
user-invocable: false
---

# Recipe index — recipe → skill sequence, grouped by area

Recipes are thin orchestration skills the top-level agent runs **inline**, spawning a subagent only
for the heavy leg — the discovery sweep (`wp-intake-discover`), dispatched to the `wp-discover` agent
(`subagent_type: wp-discover`). Confirmation gates and contract artifacts stay in main context; large
artifacts pass by file (`wp-ref-conventions`).

Building blocks (2026-07-10 discovery consolidation — three-verb model **discover → file →
reconcile-queries**): 0 `wp-binder-resolve`, 1 `wp-client-queries-info-needs`,
**`wp-intake-discover`** (the one scoped discovery skill — anchors `held` / `needs` / `queries` /
`thread`; absorbed the former info-search, intake-triage, response-reconcile, and response-process's
thread-read), 3 `wp-client-queries-info-match`, 4 `wp-intake-file`,
5 `wp-client-queries-query-record`, 9 `wp-client-queries-query-status-review` (reconcile query
statuses before drafting — promote not-ready → `ReadyToSend`, mark looks-answered → `Resolved`, in two
batched tables; runs before 6), 6 `wp-client-queries-query-compile`,
`wp-client-queries-query-advance` (the query epilogue — formerly response-process).
(Skill 8 `wp-query-followup` was retired in the 2026-07-09 refactor — chasing unanswered queries is
part of File & Follow-up, which drafts reminders via 6 and produces the ageing report.)

## Shared `intake` capability

| Recipe | Friendly name | Sequence | Summary |
|---|---|---|---|
| `wp-find-and-file` | File what we already hold | 0 → `discover(held)` → 4 *(→ query-advance for query-linked items)* | Holdings-driven: sweep everything the firm holds for the client, classify each item to a binder location (an account/section record, or an internal file-note), file it; candidates tagged `relatedQueryId` flow through the query epilogue. No client interaction. |

## `client-queries` area

| Recipe | Friendly name | Sequence | Summary |
|---|---|---|---|
| `wp-client-queries-initial-request` | Initial Information Request | 0 → 1 → `discover(needs)` → 3 → 4 → 5 → `query-advance`ᵒᵖᵗ → 9 → 6 | The first, from-scratch client ask: find needs (gap analysis lives only here), then one discover sweep (broad + per-need) finds & files what satisfies them, match verdicts the need-linked subset, record queries for the rest, reconcile statuses, draft the request. **Group / multi-binder scope fans out one read-half `wp-discover` worker per entity** (needs→discover→match), then runs the write-half per entity inline behind gates — see the recipe's "Group / multi-binder scope" section. Re-runnable — dedups against open queries. |
| `wp-client-queries-compile` | Draft Queries | 0 → 9 → 6 | Turn already-recorded queries into output: reconcile statuses first (batched tables — `Resolved` / `ReadyToSend`), then correspondence (default) or a read-only table/other format; fresh / follow-up / mixed wording; mark `Sent` only on confirmation. Reasons over the binder's own query records — never the inbox. |
| `wp-client-queries-file-and-followup` | File & Follow-up | 0 → `discover(thread\|queries)` → 4 → `query-advance` → (9 → 6)ᵒᵖᵗ | The only inbox-reading recipe: file a single open email (discover `thread`) or scan for everything unfiled (discover `queries`), advance the matching queries, then optionally reconcile statuses and draft a follow-up (6, follow-up flavour) with the ageing report. Schedulable. |

## Job-type scope for wp-binder-resolve

Every `client-queries` recipe's resolve step (0) is scoped by **job type** (binder type), since a
client or client group routinely has several open at once — a year-end binder, a BAS binder, a
management-reporting binder, all live together.

**Existing binders by default; anticipation is opt-in.** `wp-binder-resolve` resolves only to
binders that **actually exist** unless the caller passes `anticipate-new-binders: true`. A recipe
that merely operates over already-recorded state (`wp-client-queries-compile`,
`wp-client-queries-file-and-followup`) takes the default and therefore never sees a speculative
prior-year basis; only a from-scratch, gap-identifying recipe (`wp-client-queries-initial-request`)
opts in to anticipate a not-yet-created binder. A new recipe that doesn't consider the distinction
inherits the safe (existing-only) behaviour automatically — see the financial-year-scope note below.

- **Explicit wording in the request wins.** Map it to a `binderTypeId` hint before calling
  `wp-binder-resolve`: "BAS"/"GST"/"VAT"/"activity statement" → `Activity Statements`;
  "management accounts"/"monthly reporting" → `Management Reporting`; "tax planning"/
  "pre-year-end planning" → `Tax Planning`; "year-end"/"annual accounts"/"accounts and tax"/"FS"
  → the accounts/tax set (`Company Financial Statements & Tax` + `Accounts and Tax`). Resolve
  names to ids via the binder-type list `active-workpapers-binders-search` already returns — never hardcode
  ids (opaque, per `wp-ref-conventions`).
- **No explicit wording — resolve unfiltered, then check for ambiguity.** Call
  `wp-binder-resolve` with no `binderTypeId` hint (all open binder types in scope), then look at
  the **distinct job-type families** among the candidates (collapse semantically-equivalent binder
  types into one family per **Job-type families** below — do **not** count raw `binderType.name`s):
  - One family only (or the candidates otherwise resolve to a single unambiguous binder) — proceed,
    nothing to ask.
  - More than one family present — **ask before proceeding.** Name the open job types found
    (e.g. "EmAy has an open year-end Accounts & Tax job, an open BAS (Activity Statements) job,
    and open Management Reporting jobs — which did you mean?"), with accounts/tax pre-selected as
    the recommended default — the large majority of "the queries"/"the binder" asks mean the
    year-end job — but let the user confirm or pick differently rather than assuming it.
- **Group scope** — a **named group (or `clientGroupId` hint) is taken whole**: `wp-binder-resolve`
  **never prompts to confirm an entity within it** — it carries every in-scope entity's relevant
  binder (a `BinderContext[]`). Only the **job-type** question is asked, and asked once for the whole
  group: aggregate the distinct **job-type families** across all entities' open binders (not per
  entity, and collapsing semantically-equivalent types per **Job-type families** below), and prompt
  only when more than one *family* is present. This matters most on a mixed group — a company entity's
  year-end binder is `Company Financial Statements & Tax` while its trust/individual siblings' are
  `Accounts and Tax`; that is **one** year-end family, so a "do the group's year-end queries" ask
  resolves cleanly without a spurious job-type prompt. (A named *single entity* stays that entity —
  group scope triggers on an explicit group only.)

### Job-type families — relate types by meaning

Binder **types are matched by their semantic meaning, not by an exact `binderType.name`/id.** The
firm's type list is not a clean 1:1 with the *jobs* a practice runs: the same engagement is labelled
differently depending on the entity's legal form, and free-text naming drifts over time. When you
count "how many job types are open" (the ambiguity trigger above) or map the user's wording to a
type hint, reason over the **family** the type belongs to.

The one that bites in this data:

- **Year-end accounts & tax** — `Company Financial Statements & Tax` (companies) **and**
  `Accounts and Tax` (trusts, individuals, associations, SMSFs — any non-company entity) are the
  **same job**. A group with a company plus a family trust will show both names for the identical
  year-end engagement; treat them as one family. The user's "year-end", "annual accounts",
  "accounts and tax", "financials", "FS" all land here.

Other families in play (extend by meaning, don't treat this list as closed):

- **Activity statements** — `Activity Statements`; user wording "BAS", "GST", "VAT",
  "activity statement", "IAS".
- **Management reporting** — `Management Reporting`; "management accounts", "monthly reporting",
  "the monthly pack".
- **Tax planning** — `Tax Planning`; "tax planning", "pre-year-end planning", "projected position".

**Decide by the semantic meaning of the names, not string equality.** When two type names clearly
describe the same piece of work — differing only by entity form, abbreviation, punctuation, or house
naming — they are one family; only genuinely different engagements (a BAS vs a year-end set) count as
separate job types worth prompting about. When a name is genuinely unfamiliar and you cannot tell
which family it belongs to, treat it as its own family rather than forcing a match.

### Financial-year scope (resolved alongside job type)

Job type fixes *which binder type*; it does not fix *which year*. A client or group routinely has
more than one financial year live at once — this year's job has just opened while last year's is
still in progress or only recently completed. Resolve anchors the **year** the same way it anchors
the type, and (on a group) to a single year shared by all entities:

- **Explicit year wording in the request wins — don't prompt for what's already established.** When
  the request names the financial year — "the 2026 jobs", "FY2026", "the 2026 year-end", or
  "this year's" resolved against today's date — that year **is** the anchor. **Do not ask the user
  to confirm the year, and do not ask which entities to include.** On group scope, the entities that
  have an open binder of the chosen type in that year are the scope; entities with **no** open binder
  in that year are simply **out of scope** — state them in one brief FYI line (not a blocking
  question) and proceed. Only fall back to a prompt when the named year has **nothing** open at all
  (last bullet). This mirrors "explicit job-type wording wins" above: never re-ask for a dimension
  the user already pinned.
- **No explicit year — anchor to the most recent *open* financial year.** Among the candidate
  binders of the chosen job type, take the latest `financialYearEndDate` that still has an **open**
  binder. Never an older year merely because it is also open, and never a completed year — an
  open/In-Progress binder on an older FY is last year's job running late, not the current request.
- **One year for the whole group.** On group scope the anchor FY is chosen **once across the group**
  (the group's most-recent-open FY of the chosen type) and applied uniformly — entities are never
  left sitting on different years. An entity with an open binder in the anchor FY is in scope
  automatically.
- **Entities with no open binder in the anchor FY — only when the year was *inferred*, not stated.**
  When the year was anchored by inference (no explicit year in the request), entities whose latest is
  Completed, only older years are open, or no binder at all are **never silently included, dropped, or
  created**: list them with their actual latest state (e.g. "EmAy — FY2025 Completed; Brian Jackson —
  FY2025 still In Progress") and ask the user which to include. **Do not offer to open a new binder.**
  When the year was **explicit** (first bullet), skip this prompt — those entities are out of scope,
  noted not asked.
- **Whole group / entity has nothing open** — if no candidate of the chosen type is open at all in
  the anchor year (everything is Completed), there is no live job to compile: tell the user and ask
  which entities/years they want to work from rather than guessing — this holds even when the year
  was named explicitly. Single-entity scope follows the same anchor and the same fallback prompt.
  - **The prior-year-basis offer is opt-in — gated on the caller passing `anticipate-new-binders:
    true`.** When a *Completed* prior-year binder of the chosen type exists (the common "there's no
    FY2026 binder, only last year's" case) **and the caller anticipates new binders**, offer — as an
    explicit choice alongside the usual ones — to **base a request for the requested year on that
    prior-year binder**: carry its information needs / queries forward as the template for the new
    year (this is the "assume this year's questions from last year" ask). **State the read-only limit
    in the option itself:** with no binder for the requested year there is nowhere to write queries,
    so this path can only *draft* the request (a compiled letter/table) from the prior year's needs —
    nothing is filed and no `ClientQuery` is recorded until a binder for that year exists.
    `wp-binder-resolve` surfaces this as a `readOnly` prior-year `BinderContext` (see
    `wp-ref-contracts`); the recipe runs its read-only subset (see the initial-request
    recipe's prior-year-basis note).
  - **By default (`anticipate-new-binders` unset / `false`) there is no prior-year-basis offer.** An
    entity with only a Completed prior-year binder (and nothing open in the anchor year) is reported
    as out of scope — one brief FYI line with its latest state — and never offered a read-only
    template, because a binder that doesn't exist has nothing to compile. Which recipes pass what:
    **`wp-client-queries-initial-request` passes `anticipate-new-binders: true`** (it exists to
    identify gaps and draft from scratch, so a prior-year basis is legitimate); **`wp-client-queries-
    compile` and `wp-client-queries-file-and-followup` take the default `false`** (they only reason
    over queries / evidence already recorded on an existing binder). See the general principle under
    [Job-type scope for wp-binder-resolve](#job-type-scope-for-wp-binder-resolve).

## Sequencing invariant

A recipe may only invoke a skill whose input contract is produced upstream in that recipe.
Concretely: `wp-client-queries-info-match` (3) consumes the need-linked `FilingCandidate[]` that
`wp-intake-discover` (`needs` anchor) produces — 3 never appears without a `discover(needs)` before it.
`wp-intake-file` (4) only ever receives `FilingCandidate[]` (from `wp-intake-discover`, or confirmed by
3). `wp-client-queries-query-advance` only runs on already-filed candidates carrying `relatedQueryId`.
A need reaches `wp-client-queries-query-record` (5) only through a `MatchResult` from
`wp-client-queries-info-match` (3) — never directly from `wp-client-queries-info-needs` (1).

## Intake (push) vs needs (pull)

Both are the same `wp-intake-discover` sweep with a different anchor. `wp-find-and-file` runs
`discover(held)` — file what we *already hold*, no needs list. `wp-client-queries-initial-request` runs
`discover(needs)` — one sweep that is broad **and** per-need, so it files held docs *and* the
gap-fillers in a single traversal, then asks the client only for what's still `not-found`. Run
`wp-find-and-file` first only when you want "file what we hold" as its own reviewed step.
