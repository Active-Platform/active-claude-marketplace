---
name: wp-intake-discover
description: Building block (shared intake capability) — search connected sources for items and propose where each belongs, scoped by an optional anchor (held / needs / queries / thread), emitting FilingCandidate[] for wp-intake-file. Widens correspondence search to the whole client group by default (where clients are managed at group level and data isn't cleanly filed per entity), attributing each hit back to the right entity. Invoke directly only for a scoped read-only spot check; recipes chain it into filing.
kind: skill
user-invocable: false
---

# wp-intake-discover — find items and propose where each goes

The **one discovery skill** for the suite. Search the firm's connected systems for relevant
documents/data, propose a filing **home** for each, tag anything that answers an open query, and dedup
against what's already filed — then hand `FilingCandidate[]` to `wp-intake-file`. One search procedure,
scoped by an optional **anchor** that tunes *what to look for* and *which downstream reconciliation
applies*. Read-only, deliberately: every write stays behind `wp-intake-file`'s (and, for query
answers, `wp-client-queries-query-advance`'s) confirmation gate.

**Anchor (the filter of what to look for):**
- `held` (default) — sweep everything the firm holds for the client; no needs list.
- `needs` — the held sweep **plus** per-need targeting; need-linked candidates carry `needId`.
- `queries` — hunt inbound channels for replies to outstanding queries; carry `relatedQueryId`.
- `thread` — one supplied email/thread; map its attachments to candidates.

**Widen to the client group by default (all broad anchors).** When `BinderContext.clientGroupId` is
set, the broad anchors (`held` / `needs` / `queries` — **not** `thread`) widen their correspondence
search to the **whole group**, then attribute each hit back to the right entity and mark its
reliability (§3/§5) — rationale and marker semantics in
the *Group-level correspondence & attribution* section of `wp-ref-conventions`.
(Distinct from a recipe's "group scope", which iterates every binder in the group.)

**Inputs:** `BinderContext`, the sources manifest (`wp-ref-sources`); by
anchor — `InformationNeed[]` (needs), an optional age/date window (queries), a thread reference
(thread); plus an optional scope filter (classification / section / date). **Output:**
`FilingCandidate[]` (`wp-ref-contracts`) — `needId?` on need-linked items,
`relatedQueryId?` on query-answering items. **Side-effects:** none.

## 1 · Load context cheaply (all anchors)

**One `active-workpapers-binders-get binderId=… panels=[…]` call** loads the whole Workpapers context
(`panels` is an **array of `{ kind, params }` objects** — repeat a kind for several slices, e.g.
`[{ kind: "matters", params: { kind: "ClientQuery", outstanding: true, previewChars: 0 } }, { kind: "records", params: { flag: true } }]`):
the binder detail/stats, a `matters` panel `kind=ClientQuery, outstanding=true, previewChars=0`
(the query-match signal — `relatedQueryId`), a `matters` panel `kind=InternalNote` (existing notes,
so a context document attaches to a relevant file-note rather than spawning a duplicate), and —
when dedup will be needed this sweep — a `records` panel (slim rows carry
`documentIds` for dedup). When account targets are needed this sweep, add a separate
`active-workpapers-binders-trial-balance-get` call (`slim=true, leafOnly=true`, filtered by
`classification`) — the trial balance is no longer a panel. Reuse a caller-supplied open-query list /
context instead when the recipe already fetched it (conventions.md — fetch once, thread forward).

**Resolve the group's addresses once (when `clientGroupId` is set).** One
`active-core-clients-entities-search clientGroupId=…` call returns every member entity **with its
`email`** — this is the address set for the widened Outlook search (§2), including the family
principals' personal addresses (e.g. `brian.jackson@…`), and the member-entity id/name list used to
attribute hits in §3. One cheap call; skip entirely when the client has no group.

## 2 · Search the sources (all anchors except a supplied `thread`)

Search the readable sources only (manifest `status=connected, read=true`; note skipped sources in the
output), scoped by client + FY window:
- `active-documents-documents-search` — scope `clientId` + `modifiedFrom`, **or, when
  `BinderContext.clientGroupId` is set, you MUST pass `clientGroupId` (not `clientId`)** (the two are
  mutually exclusive — **exactly one is required**; group scope catches documents filed under a sibling
  entity or at group level — and a `clientId`-scoped search of a grouped entity **silently returns
  nothing filed at group level or against a sibling** (no error), so entity-scoping a grouped client
  will miss held evidence and manufacture false gaps; the
  search defaults to a ~6-month window, so pass `modifiedFrom` to reach older docs); **`source=FromClient`
  is a strong intake signal**; email threads collapse by default (`collapseEmailThreads`), and a hit's
  full conversation comes from `active-documents-documents-thread-list`; **no per-item `documents-get`
  for bulk triage** — open a single ambiguous item only under the confirm-by-opening cap
  (`wp-ref-conventions`, applied in §3). Leave `ref` empty, set `documentId`.
- `outlook_email_search` + `read_resource` — client's address + FY window, **or, when in a group, the
  member/principal address set from §1** (and/or the group/family name as free-text `query`), not just
  the single client address. Then `sharepoint_search` / `sharepoint_folder_search`,
  `chat_message_search`.

**Anchor tuning of the search:**
- `held` — broad client + FY queries only.
- `needs` — the broad queries **plus** per-need terms (account/section name, `kind`, client name, FY
  window; for an `expected-absent` need build terms from the **section/topic name** + `kind`; for a
  `flaggedActivity` need lead with the **activity keywords**). **Maximise catch — return everything
  relevant, not just need-matches** (the needs list *adds* targeting, it never *restricts* the sweep).
- `queries` — scan **inbound channels only**: `outlook_email_search` by client address + window (**or
  the group member/principal address set from §1 when in a group** — a client reply often comes from a
  principal or a central bookkeeping address, not the entity's own address);
  `documents-search source=FromClient modifiedFrom=<sent date>` (+
  `active-documents-documents-thread-list` for a hit's thread) for items arriving after the query
  went `Sent`. Match replies to queries on account names,
  query titles, and thread subjects.
- `thread` — skip the broad scan (no group widening); `read_resource` (Outlook item) or
  `active-documents-documents-thread-list` (a documents-side thread) on the one supplied reference;
  its attachments become the candidates. **A group-addressed thread's attachments may belong to this
  or a sibling entity — attribute each per §3 before proposing a home.**

## 3 · Propose a home per item — a record or an internal note

**Attribute first (group-scope hits), and mark the reliability.** A hit found at group scope is not
yet known to belong to *this* binder's client. Before proposing a home, attribute it to the correct
entity (entity named in title/subject/body; amounts/accounts matching **this** binder's TB; period;
sender/recipient address mapped to a member entity from §1) and tag the candidate with the
**provenance marker** (`client-scoped` / `group→this` / `group→sibling` / `group→ambiguous`) in its
`rationale` — full marker semantics and confidence rules in
the *Group-level correspondence & attribution* section of `wp-ref-conventions`. In
short: `group→this` proposes the home with capped-lower `confidence`; `group→sibling` /
`group→ambiguous` are **never filed on this binder** — emit with empty home fields on the
human-routing path (sibling hits record *"belongs to sibling <entity> — consider filing there"*).

**Confirm by opening — only when metadata can't decide it (capped).** Classify from metadata first;
the full rule, the cheapest-first method ladder, and the per-sweep cap (~3–5) live in
the *Confirm-by-opening (document inspection)* section of `wp-ref-conventions`. The primary
"materially matters" trigger here is a **group-scope hit** (`group→this` / `group→ambiguous`) whose
attribution turns on a body detail, plus an opaque filename or an unclear query answer. **Record the
outcome** in the candidate's `inspection` marker (`opened`, `method`, `note`).

- **Record home (default for account evidence).** Set `proposedTarget`: account/section, an existing
  `recordId` or `createNewRecord`, with `classification`, `confidence`, and a one-line
  `rationale` (records are created as the default kind — no `recordType`). Ground the account in the TB
  slice (names/classifications), not guesses. Documents spanning several accounts follow the multi-account
  schedule convention in conventions.md (section-level record preferred, header account alternative) —
  name the accounts covered and flag judgement-y placements for reviewer confirmation. On the
  `needs`/`queries`/`thread` anchors the home comes from the linked need's or query's scope
  (`existingRecordId` / `sourceAccountId` when set).
- **Note home (context/correspondence with no clean account home).** For a client letter, meeting note,
  or general background, propose `relatedNoteId` when a relevant existing file-note is in the loaded
  list (attach — don't duplicate), else `proposedNote:{ noteType:'InternalNote', title, description?,
  sourceAccountId?, sectionId? }` (the optional parent the filer links the note to via
  active-workpapers-binders-attach). Discovery only ever proposes plain notes (`InternalNote`), never
  ReviewPoints.
- **Ambiguous** (no plausible record or note home) → emit with all home fields empty and flag for human
  routing rather than guessing.

## 4 · Tag query answers & dedup (all anchors)

- **Query-aware tagging.** When an item answers an open query (an inbound reply, or a document a query
  asked for), set `relatedQueryId` — **additive** on top of its home. **Never silently swallow a query
  answer**: filing the document while leaving the query `Sent` would make the follow-up sweep chase the
  client for something we already hold. The recipe routes tagged candidates through
  `wp-client-queries-query-advance` after filing. This is the primary signal on the `queries`/`thread`
  anchors and fires opportunistically on `held`/`needs`.
- **Judge `alreadyFiled` on the QUERY, not the document** (`queries` anchor). A reply counts as unfiled
  when its query carries **no answer message / no status change** — even if the attachment was already
  filed by an earlier sweep. Such a reply still routes to `query-advance`, which skips the duplicate
  filing (idempotent by `documentId`) and runs just the epilogue. Queries whose reply is already fully
  recorded are reported `alreadyFiled: true` and not routed.
- **Dedup against what's already filed — conclude from the list.** Slim record rows carry
  `documentIds:[…]` (S8 — dedup mechanics in conventions.md), so set `duplicateOfDocumentId` when a
  candidate's `documentId` already appears in a target row's `documentIds` — no
  `active-workpapers-workpaper-records-get` needed.
  Honours one-record-per-account. For a **note-home** candidate, `wp-intake-file` finalises dedup
  against the target note's conversation hyperlinks before posting — don't over-fetch here. For a
  **group-scope** hit, dedup against records on the **correctly-attributed entity's** binder (a doc
  already filed under the right entity is a duplicate).

## 5 · Emit `FilingCandidate[]`

One per item, ranked/annotated by `confidence`; keep `snippet` short — full bodies never travel in the
artifact. Each candidate carries its `inspection` marker (`opened`/`method`/`note`, default
metadata-only). **Segregate by reliability:** group / label candidates by their provenance marker
(§3) — client-scoped visibly distinct from group-derived — per the conventions' attribution rules;
downstream presentation (the filer's confirm-batch/recap, match's verdict) inherits the markers. On
the `needs` anchor the result set is a **union** of (a) **need-linked** candidates
(`needId` set, home from the need's scope) and (b) **incidental** candidates with a clear home but no
need — general correspondence, docs for accounts with no raised need. Both are filed;
`wp-client-queries-info-match` adjudicates only the need-linked subset. A need with no plausible hit
simply produces no need-linked candidate (match decides `not-found`).

## Run as a subagent (default for a full sweep)

Open-ended sweeps read many doc/email bodies — the suite's biggest context sink. For anything beyond a
1–2 item spot check (or a single `thread`), dispatch this skill to the **`wp-discover` agent**
(Agent tool, `subagent_type: wp-discover`) whose prompt includes:
this skill file's path, the anchor and its inputs (`InformationNeed[]` inline or by path, thread ref,
window), the `BinderContext` inline, **the resolved group member-entity id/name/address set (§1) when
in a group** so attribution happens inside the subagent, the manifest path, the scope filter, and an
output artifact path in the session scratchpad. The subagent writes the full `FilingCandidate[]` to
that file and returns only `{ counts by source, per-candidate one-liners (each carrying its provenance
marker and its opened indicator when inspected), filePath }`. Any confirm-by-opening inspection is
read-only, so it happens **inside** the subagent and counts against that sweep's cap — the bodies it
reads never travel back, only the resulting `inspection` marker. Group widening enlarges the sweep
(N addresses + a group-scope document pass), so it further favours the subagent. On the `needs` anchor
you may run one subagent per source or per need-batch, in parallel.

**Synergy:** on the `needs` anchor the broad leg fills records the same pass it hunts gaps, so a
separate `held` pre-sweep is unnecessary — the sources are traversed once.
