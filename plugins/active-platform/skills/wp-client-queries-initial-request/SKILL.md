---
name: wp-client-queries-initial-request
description: Use when the user wants the first, from-scratch client information request for a binder — "work out what we need from Behemoth and draft the request", "prepare the initial information request", "what do we need to ask the client for, and ask them". Resolves the binder, finds gaps, searches held & other systems for what satisfies them, files what's found, records queries for the rest, drafts the client document.
kind: recipe
---

# wp-client-queries-initial-request — Initial Information Request

**Sequence:** `wp-binder-resolve` → `wp-client-queries-info-needs` → `wp-intake-discover` (anchor
`needs`) → `wp-client-queries-info-match` → `wp-intake-file` → `wp-client-queries-query-record` →
*(`wp-client-queries-query-advance`)*ᵒᵖᵗ → `wp-client-queries-query-status-review` →
`wp-client-queries-query-compile`.
Index: `wp-ref-recipes`; conventions & artifact-by-file rules:
`wp-ref-conventions`.

The **from-scratch** client ask: identify gaps, resolve what we can from what the firm already holds or
can find, and draft the first request. **Gap analysis (`wp-client-queries-info-needs`) lives only
here** — once the request is out, the job runs on `wp-client-queries-compile` (redraft/chase) and
`wp-client-queries-file-and-followup` (file replies + follow up). **Re-runnable:** before the client has
responded, re-running just re-produces the same draft (unless binder data changed);
`wp-client-queries-query-record` dedups against open queries, so nothing double-raises.

Run inline; spawn a subagent only for the heavy leg (the discover sweep), dispatched to the
`wp-discover` agent (`subagent_type: wp-discover`). Contract artifacts
(`InformationNeed[]` → `FilingCandidate[]` → `MatchResult[]` → `FiledArtifact[]` / `RecordedQuery[]`)
chain each step; large ones pass by scratchpad file.

**Discovery is mandatory — every gap is checked against what we already hold before it becomes a
query.** Each `client` / `hybrid` need from step 2 MUST pass through discover (3) → match (4) before it
is presented, filed, or recorded. An `InformationNeed` with no corresponding `MatchResult` is **not a
candidate query — it's an unchecked gap**: never go from the info-needs / trial-balance gap-scan
straight to presenting or recording queries. The subagent is only *where* the heavy sweep runs, not
*whether* it runs — **if you cannot spawn the `wp-discover` subagent, run `wp-intake-discover` inline in
the main context instead.** Never treat subagent-unavailability as licence to skip discovery.
**And scope discovery to the whole group when the client is in one:** if `BinderContext.clientGroupId`
is set, search documents by `clientGroupId`, not `clientId` — an entity-only search of a grouped client
silently returns nothing filed at group level or against a sibling (no error), so it will miss held
evidence and invent false gaps (see `wp-ref-conventions` → *Group-level correspondence & attribution*).

## Orchestration

1. **Resolve** — `wp-binder-resolve` **with `anticipate-new-binders: true`** → `BinderContext`(s)
   (job-type scope per
   the *Job-type scope for wp-binder-resolve* section of `wp-ref-recipes`; with `priorBinderId`
   when one exists). This recipe is the **one** that opts into anticipating a not-yet-created binder:
   the flag is what lets resolve surface the *read-only prior-year basis* handled in the "Prior-year
   basis" section below — because identifying gaps and drafting a first request from last year's
   template is legitimately this recipe's job. (Recipes that only compile / file already-recorded
   state take the default and never see that offer.) **Group scope → every in-scope entity binder in
   the group, no per-entity confirmation** (a named group is taken whole; **job-type and
   financial-year scope are still resolved** — anchored to the group's most-recent-open FY, uniform
   across entities; entities with no open binder in that year are surfaced for the user to include,
   never auto-picked or created).
   Steps 2–8 then
   run **per binder** and step 9 compiles **one consolidated group request** (see below). Load the
   sources manifest. **If resolve returns a `readOnly` prior-year `BinderContext`** (the requested
   year has no binder — see `wp-ref-contracts` and the note below), run
   the **read-only subset** instead of the full write flow.
2. **Needs (inline)** — `wp-client-queries-info-needs` → `InformationNeed[]` (only `client` / `hybrid`
   provenance; firm/ledger items are reported as a one-line "handled internally / from the accounting
   records — not asked" rollup, not carried forward). Show the rollup (counts by status/priority); call
   out any `expected-absent` needs (anticipated items not yet in the TB) as a distinct line. Needs
   already `requested` don't proceed to search — they're already asked. `expected-absent` needs carry a
   normal status and flow through like any other — section-scoped rather than account-scoped.
   **Keep the open-query list its panels call returned** — hand it to steps 3, 6 and 8 so none of
   them refetches it (conventions.md — fetch once, thread forward).
3. **Discover — one sweep (mandatory; subagent, or inline if none)** — `wp-intake-discover` on the **`needs`** anchor
   (`subagent_type: wp-discover`) over the
   `missing` / `partially-held` needs. A **single** traversal of the sources: it runs the broad client
   sweep **and** per-need targeting together, so held account-docs and general correspondence are caught
   and filed the same pass — no separate intake pre-pass is needed. Artifact to file; distilled
   per-candidate summary back. Result set = **need-linked** candidates (`needId`) **+ incidental**
   candidates (a home, no need).
4. **Match (inline — auditable)** — `wp-client-queries-info-match` over the **need-linked** subset →
   `MatchResult[]` (found/partial/not-found). Incidental candidates bypass match. Present the per-need
   verdicts.
5. **File (inline)** — `wp-intake-file` on the `found`/`partial` need-linked candidates **+ all
   incidental candidates**; one confirmation batch. Candidates tagged `relatedQueryId` are noted for
   step 7.
6. **Record (inline)** — `wp-client-queries-query-record` on the `not-found`/`partial` needs **as
   classified by step 4's `MatchResult[]`** (a need reaches record only via a match verdict, never
   straight from step 2's gap-scan); dedup against open queries; one confirmation batch →
   `RecordedQuery[]`.
7. **Advance answered queries (inline, optional)** — on a re-run where open queries already exist, any
   filed candidate carrying `relatedQueryId` goes to `wp-client-queries-query-advance` (post answer,
   advance status). On a true first run there are no queries yet — skip.
8. **Reconcile statuses (inline)** — `wp-client-queries-query-status-review` over the recorded queries,
   as two batched tables (one confirmation each), reasoning over the queries' own recorded state only.
   On a true first run the Resolved batch is empty and the ReadyToSend batch is the just-recorded
   `Created` queries (promote so step 9 can draft them as a first ask); on a re-run where step 7 fired,
   any query the reply satisfied surfaces in the Resolved batch.
9. **Compile (inline, outward gate)** — `wp-client-queries-query-compile` over the reconciled queries →
   draft email/letter (fresh flavour — first ask); when the channel is email and a draft-capable mail
   engine is connected (`outlook-email.draft` + the firm's `emailDraft` preference), it offers to drop
   the request into the user's mailbox as a draft, else shows it inline. Statuses flip to `Sent` only on
   the user's explicit send confirmation. On **group scope**, pass every group binder in one call → **one
   consolidated request** covering the related entities (each ask marked/grouped per the `grouping`
   preference), not one letter per entity.
10. **Report** — the artifact chain end-to-end: **needs found**, filed matches **per the filer's recap**
   (found + incidental — `wp-ref-conventions`, post-filing recap; don't
   re-list them), **queries recorded** (new vs reused), and **the drafted document's status**.

## Group / multi-binder scope (fan-out — keeps context flat)

When resolve (1) returns **more than one binder** (a group ask, or several open binders in the chosen
job type), do **not** run the full recipe for all of them in one context — five binders × the inline
legs (needs slices, match verdicts, filer recaps, drafts) exhausts context before any draft lands.
Instead:

1. **Resolve once, inline (interactive).** Do client/group resolution, job-type disambiguation, and
   financial-year anchoring (most-recent-open FY, uniform across the group) in main context per
   the *Job-type scope for wp-binder-resolve* section of `wp-ref-recipes` → a list of
   `BinderContext`s (each with `priorBinderId` where one exists). Any entity without an open binder
   in the anchor year is surfaced for the user to include before fan-out — not carried silently.
2. **Read-half per entity (subagent, parallel).** For each resolved binder, spawn **one `wp-discover`
   read-half worker** (`subagent_type: wp-discover`, **mode B**) — it runs `info-needs` →
   `intake-discover(needs)` → `info-match` for that one binder and returns only the distilled bundle
   (`{ needs rollup, per-need match verdicts, toFile candidate path, toRecord not-found needs,
   filePath }`). Pass that binder's `BinderContext`, the manifest path, the group member-entity set,
   and a per-binder output artifact path. These are independent and read-only — run them concurrently.
3. **Write-half per entity, inline behind gates — one entity at a time (steps 5→8 only; NOT compile).**
   For each binder's bundle, run the per-binder writes (steps 5→6→7ᵒᵖᵗ→8) inline in main context behind
   their confirmation gates, then drop that entity's raw detail and move on before starting the next — so
   the orchestrator only ever holds N small bundles plus one entity's write-half, never N binders' raw
   slices. **Do not compile per entity** — that would fragment the group into one letter each. Carry
   forward only each entity's small reconciled open-query set (the step-8 output) plus its filer recap.
4. **Compile once — one consolidated group request (step 9).** After *every* entity's write-half is done,
   run `wp-client-queries-query-compile` a **single** time across all entities' reconciled query sets
   (pass every group binder as `binderId: [...]` in one call) → **one** draft covering the related entities,
   each ask marked/grouped per the `grouping` preference — never one letter per entity. Same outward gate
   and send-confirmation as step 9.
5. **Consolidated report (step 10).** Close with a group rollup (per entity: needs found, queries
   recorded, draft status) referencing each entity's filer recap rather than restating filing detail.

Single-binder scope runs steps 2–9 as written; for a very dense single binder you may still use one
mode-B `wp-discover` read-half worker to keep the needs slices out of main context.

## Prior-year basis — read-only (requested year has no binder)

When the requested year has **no binder** and the entity's latest of the chosen type is a *Completed*
prior year, `wp-binder-resolve` may — **because this recipe resolved with `anticipate-new-binders:
true`** (step 1) and on the user's choice — return that prior-year binder with **`readOnly: true`**
(the "assume this year's questions from last year" ask). (Without that opt-in the offer never
surfaces, which is exactly why the compile / file-and-follow-up recipes never reach this subset.) The binder, TB and
records in that `BinderContext` are **last year's**, used only as the template to derive what to ask
for the requested year. Run this **read-only subset**:

- **Run** steps 2 (needs) → 3 (discover) → 4 (match) → 9 (status reconcile, in-memory only) → 9-compile
  against the prior-year binder, framing needs/queries for the **requested** year (carry the prior
  year's needs forward).
- **Skip every write:** no step 5 filing, no step 6 `wp-client-queries-query-record`, no step 7
  query-advance, and step 8 reconciliation stays **in-memory** — there is no binder for the requested
  year to persist a `ClientQuery` against. Do **not** offer to create one.
- **Output is a draft only.** Compile (9) produces the request document (letter/table) exactly as
  usual, but there is nothing to mark `Sent` and nothing recorded. **Lead the report with the
  read-only caveat** (from `readOnlyReason`): the request is derived from last year's binder and
  nothing has been filed or recorded — recording queries needs a binder for the requested year first.

## Confirmation gates (in order)

Found + incidental filing (5) → query creation (6) → query-advance if it fires (7) → status
reconciliation (8) → the outward client document (9). Reads in between are free.
