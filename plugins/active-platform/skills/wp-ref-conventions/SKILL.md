---
name: wp-ref-conventions
description: Reference — shared conventions for the wp-* Workpapers skill suite (confirmation policy, confirm-by-opening, post-filing recap, group-level attribution, token budgets, artifact handoff, domain enums, server surface). Loaded by wp-* skills via the Skill tool; not a standalone task.
kind: skill
user-invocable: false
---

# Workpapers skill-suite conventions (area-agnostic)

Shared conventions for every `wp-*` skill. Skills point here instead of restating.
Companion reference skills, loaded the same way (via the Skill tool): data contracts in
`wp-ref-contracts`; the capability manifest in `wp-ref-sources`; the recipe index in
`wp-ref-recipes`.

## Servers and ids

- One MCP server, keyed `active-mcp` in the plugin's `.mcp.json`, exposes the whole Active surface: Active core (`active-core-*`),
  documents (`active-documents-*`), and workpapers (`active-workpapers-*`). The Microsoft 365
  connector separately supplies Outlook / SharePoint / Teams search + `read_resource`.
- **Ids are opaque across resource domains.** Workpapers references document ids owned by the
  documents surface and never resolves them itself. Skills orchestrate by passing ids; never invent
  or transform an id.

## Domain enums (pin to these exactly)

- **Query (client query) lifecycle:** `Created | ReadyToSend | Sent | InProgress | Resolved |
  Actioned`. `Actioned` is **terminal** — sweeps and follow-ups treat it like `Resolved`.
  "Open" / outstanding = `Created | ReadyToSend | Sent | InProgress`.
- **Record status (`systemStatus`, 7-value):** `Created | InProgress | ReworkRequired | ClientQuery |
  ReadyForReview | Approved | Complete` (read/search). Create default is `Created`. **Writes stop at
  `ReadyForReview`:** `Approved` and `Complete` are the sign-off — reaching either records an approval
  against the caller — so `records-apply` **refuses** them and returns a link to the record's binder:
  - **Approving is the responsible person's, never yours.** Relay the binder link and ask the user to
    approve it themselves in Active Workpapers; use `ReadyForReview` to hand a record over for sign-off.
    Don't retry with an approval status or route around the refusal.
  - The full 7-value set is still *sent* to the API (that is what lets it refuse with the binder id) — so
    a refusal comes back as a linked message, not a local "invalid status" error. Matters are unaffected:
    resolving a matter, including a review point, is fine.
- **Record types:** `Worksheet | Standalone | StandaloneChecklist | DocumentPlaceholder | ActiveSheet`
  (`Standalone` = file note/memo; `StandaloneChecklist` = checklist item; `DocumentPlaceholder` = a
  reference to an external document). recordType is a **search filter / read field only** — it is
  **not** a create param (records are created as the default kind).
- **`reconciliationOption`:** `Field | Value | External | ActiveSheet` (read/search). There is no "none"
  — a record reconciles iff a `reconciliationOption` is set. **Writes are manual-only:** through MCP you
  may only set `Value` (a manual amount). `Field`/`External`/`ActiveSheet` are pointers to an Excel named
  range or another synced source (`isExcelLinked: true` on the record's reconciliation) — Excel owns those
  figures, so they are read-only here:
  - **Never toggle a linked record to a manual value.** `records-apply` **hard-rejects** any
    reconciliation write on a record whose current option is `Field`/`External`/`ActiveSheet`, and rejects
    a `reconciliationOption` other than `Value`. If a manual figure genuinely belongs there, unlink the
    field in the Workpapers UI first — don't force it.
  - **A manual value must come from an external document/source** — e.g. the closing balance on an
    attached bank statement for the binder end date. **Never** copy it from the trial balance or the
    linked source-account figure: that is the number the reconciliation *validates*, so using it is
    circular.
- **Note types:** `ReviewPoint | InternalNote` (two values, on both create and read). `ReviewPoint`
  requires an approver to resolve. There are no other create-time presets.

## One record per account

Documents attach to a **record** (a record supports many documents). Convention: reuse the
existing per-account record; create a new record only when none is obvious. All filing goes
through `wp-intake-file` — no other skill writes records/documents (or internal-note attachments,
the alternative home for context/correspondence with no account record).

### Multi-account schedules (spanning documents)

A document that spans several accounts (a prepayments amortisation schedule, a fixed-asset
depreciation schedule, a combined payables/accruals reconciliation) has no single-account home
under one-record-per-account. Convention, in preference order:

1. **Needs-driven filing with a known target:** when the consuming need carries an
   `existingRecordId` (the account the need was raised against), attach there — the need's
   account is the document's primary anchor.
2. **Section-level record** when the accounts all sit under one section: one new record linked
   to the `sectionId`, titled for the schedule, with a note naming the accounts covered.
3. **Header-account record** when a header account cleanly parents all covered leaves.

Never attach the same document to multiple per-account records — one home per document. When
the choice is judgement-y (confidence < ~0.7), flag it for reviewer confirmation in the
candidate's `rationale` rather than deciding silently.

### Dedup mechanics — record rows expose attached document ids (S8)

`active-workpapers-workpaper-records-search` slim rows carry both `docCount` and `documentIds:[…]`
(the attached document ids), so discovery skills (triage, match) and the filer establish duplication
**from the list alone** — a candidate `documentId` already present in a target row's `documentIds` is
a confirmed duplicate; no per-record fetch is needed. Reach for
`active-workpapers-workpaper-records-get` (batched — `ids:[…]`) only when you need a document's
*name* or the record body, not to check attachment identity. Write acks also carry the record's
post-write `documentIds`.

## Confirmation & dedup policy

1. **Reads are free.** Listing / searching / reading needs no gate, across every system.
2. **Writes batch-confirm, then apply as ONE call.** Creating records/queries, attaching
   documents, posting messages: present the full batch (what will be created/updated, on which
   targets), get one confirmation, then apply the whole batch with a **single**
   `active-workpapers-matters-apply` / `active-workpapers-workpaper-records-apply` call (`creates[]` +
   `updates[]`, validated up front, all-or-nothing — the server-side mirror of this gate). Writes return
   compact acks (`{ id, changed, … }`), not full detail; trust the ack, don't refetch to verify.
3. **Outward-facing always confirms.** A client-facing email/letter is always shown and
   explicitly confirmed. Query statuses flip to `Sent` **only** on the user's explicit
   "sent / will send" confirmation — never on draft. (No send-capable tool exists in this
   environment; see `wp-ref-sources`.)
4. **Dedup before create.** Reconcile every candidate against existing open queries and existing
   records/documents before raising or filing anything new. The same gap must never spawn a
   second query; the same document must never spawn a duplicate record.

## Group-level correspondence & attribution

Clients are frequently **managed at the client-group level**: correspondence (emails, filed
documents) and client data are often **not cleanly filed per entity** — a reply for one entity may
arrive from a family principal, land in the group's shared filing, or sit against a sibling entity.
So when a binder's client is in a group (`BinderContext.clientGroupId` set), group-scoping is
**required, not preferred** — discovery **widens correspondence search to the whole group** (documents
via `clientGroupId`; Outlook via the member/principal address set), then **attributes each hit back to
the correct entity**. Entity-scoping (`clientId`) a grouped client is a **silent** failure: the search
returns a false clean result — nothing filed at group level or against a sibling — **not an error you'd
notice**, so a genuine held document reads as a gap and gets asked for. Always scope documents by
`clientGroupId` whenever `BinderContext.clientGroupId` is set. Attribution then routes each hit — this binder's
client, a sibling (surfaced, not filed here — "belongs to sibling, file there"), or ambiguous (flagged
for human routing). A group-scope attribution is **inherently less reliable** than a clean
client-scoped hit, so every candidate carries a **provenance marker** (`client-scoped` / `group→this`
/ `group→sibling` / `group→ambiguous`) in its `rationale`, `group→this` gets a **capped-lower
`confidence`** with borderline calls going to reviewer confirmation, and output is **segregated by
marker** (client-scoped visibly distinct from group-derived) through discovery, the filer's
confirm-batch/recap, and match. Distinct from a *recipe's* "group scope" (iterate every binder in the
group); this is search-surface widening for one binder. Owned by `wp-intake-discover`; reusable by
future `review`/`prepare` areas.

## Confirm-by-opening (document inspection)

Classification is **metadata-first**. A found item's home and identity are decided from cheap
signals — title/filename, `source`, sender, date, the search-result snippet, any document-type
tag, and account/amount hints — **without opening the document**. Opening a document is expensive
(a full `documents-get` embeds the entire email thread), so it is the deliberate exception, not
the default. This convention is owned here and applied by `wp-intake-discover` (while proposing a
home) and `wp-client-queries-info-match` (its borderline re-read); future `review`/`prepare`
areas inherit it.

**Open only when ALL of these hold:**
1. Metadata leaves the **home or identity genuinely uncertain** — a generic/opaque/numeric-only
   filename (`scan.pdf`, `attachment(3).pdf`, `IMG_1234.jpg`), a title that conflicts with the
   folder/account context, or a case where a body detail is what decides the account/entity/period.
2. Resolving it **materially matters** — a group-scope attribution (`group→this` / `group→ambiguous`),
   an item that would answer an open query but whose match is unclear, or a high-value/high-risk
   placement (a multi-account schedule, a reconciliation).
3. Opening would **plausibly resolve** the uncertainty.

**Do NOT open** when metadata already decides the home, the item is a clear duplicate
(`duplicateOfDocumentId`), or it is low-value incidental correspondence heading to a file-note.

**Cheapest method first (the ladder):** search-result snippet / thread rows via
`active-documents-documents-thread-list` (pass any email doc id) → `read_resource` (an M365
item/attachment body) → `active-documents-documents-get` (one targeted Active document — a plain
by-id fetch; it carries no thread children). When a PDF/xlsx *body* must actually be read, mint a
download link with `active-documents-documents-link` (`linkType: download`) and read the bytes from it.

**Per-sweep cap (~3–5, tunable).** Prioritise the docs to open by uncertainty × value. Beyond the
cap, leave remaining low-confidence items **unopened**, cap their `confidence`, and route them to
reviewer confirmation (the empty-home / human-routing path) — never open everything. Inspection is
read-only, so it is allowed inside the discovery subagent and counts against the cap there.

**Record what you did.** Every candidate carries an `inspection` marker
(`wp-ref-contracts` — `FilingCandidate.inspection`): `opened` (bool), the `method` used,
and an optional `note` of what opening confirmed. It defaults to metadata-only and flows through
the filer to the confirm-batch and the post-filing recap so a reviewer can tell a verified
placement from a metadata-only guess.

## Post-filing recap (review, not approval)

Every flow that files — through `wp-intake-file`, on any anchor and in any area — **recaps the
filed batch to the user after the writes apply**: per item, its home (account/record, or note),
the action taken (attached / created-record / created-note / new-version / placeholder /
skipped-duplicate), the one-line reason it landed there (the candidate's `rationale`, with
`confidence`/`classification` where useful), and **whether it was opened to confirm and by what
method** (the `inspection` marker — `✓ <method>` when opened, `– metadata-only` otherwise; see
[confirm-by-opening](#confirm-by-opening-document-inspection)). The pre-write confirm-batch shows
the same opened indicator so the reviewer sees it before approving. This is a **scan/review**
artifact — it never asks for approval; the batch-confirm in the confirmation policy above already
did that, before the writes. The filer owns this recap. Recipes' end-of-run reports **reference**
it and add only their own higher-level framing (needs found, queries raised/advanced, ageing) —
they never restate per-item filing detail.

**Close with a review link.** End the recap with the single most-useful deep-link for each binder
touched, so the user can review the changes in Active without asking — one link per binder, not per
row. Append the sub-screen that surfaces what changed to that binder's `webUrl` (`active-assistant` —
link record names into the app): `/matters/notes` when notes were created or posted to,
`/matters/queries` for queries, otherwise the records / `/index?tab=trial-balance` view. A bare binder
`webUrl` only lands on the binder root, so pick the sub-screen the batch's changes live on.

## Cross-server document transfer

How a found M365 / third-party item becomes an Active document, in preference order:

1. **`active-documents-documents-create` with `sourceUrl`** when the source exposes a fetchable
   URL (e.g. a SharePoint item URL).
2. **Upload flow** when bytes are locally available: `active-documents-uploads-start` → PUT the
   bytes → `active-documents-documents-create` (or `-document-versions-create` for a new version
   of an existing document) referencing the upload.
3. **Fallback:** file a placeholder record (via `active-workpapers-workpaper-records-apply`)
   carrying the source ref in `notes`, flagged for human upload. Never fake a document id.

## Token-budget defaults

- **Orient with one call.** `active-workpapers-binders-get` takes a single `binderId` plus optional
  `panels` — an **array of `{ kind, params }` objects** (`kind`: `records` | `matters` |
  `sections`), NOT an object keyed by kind, each entry's `params` being the matching
  search tool's filters, e.g.
  `panels: [{ kind: "matters", params: { outstanding: true } }, { kind: "records", params: { flag: true } }]`.
  One binders-get-with-panels replaces a fan-out of orientation search calls; use it whenever a skill
  needs two or more slices of the same binder. **Panels share one response**, so on a dense
  binder split into two calls rather than risk one response tripping the tool-result cap.
- **The trial balance is NOT a panel.** Balances come only from `active-workpapers-binders-trial-balance-get`
  (or `active-workpapers-source-accounts-search`), fetched as its own call — never fanned out on
  `binders-get`. To read a *part* of the ledger ("the assets", one account), filter by `classification`
  and/or `search`; don't page the whole trial balance to find a slice of it.
- `previewChars=0` on `active-workpapers-matters-search` (and the `matters` panel) for dedup or
  status rollups — the conversation body isn't needed there; it drops the preview field entirely.
  (Matter rows carry a slim derived `account` {id,accountNo,accountName} with no balances, so there
  is nothing further to trim.)
- `active-documents-documents-search` collapses email threads by default (`collapseEmailThreads`,
  default true); pull a collapsed conversation with `active-documents-documents-thread-list` (pass
  any email doc id in the thread), under the per-sweep cap in
  [confirm-by-opening](#confirm-by-opening-document-inspection). `documents-get` is a plain by-id
  fetch (no thread children). Note `documents-search` requires **exactly one** of
  `clientId`/`clientGroupId` (for a grouped client pass `clientGroupId` — entity-scoping silently omits
  group/sibling docs; see *Group-level correspondence & attribution*) and defaults to a ~6-month
  modified window — pass `modifiedFrom` to reach older documents.
- The trial balance is **always filtered**: `leafOnly`, `unreconciled`, `hasRecords`,
  `classification` (one value or an OR-set array; omit ⇒ all), `includeZeroBalance=false` — never
  an unfiltered full-binder sweep (≈200 KB on the Behemoth seed binder); page with `page`/`pageSize`.
  Take `slim=true` for positional `balances:[n,…]` aligned to the response `columns` — roughly halves
  a large TB.
- `active-workpapers-workpaper-records-search` slim rows over `active-workpapers-source-accounts-get`
  when only records are needed.
- `active-workpapers-matters-messages-list` default `limit=20` (cursor-paged, newest-first); page
  older only when the question demands it.
- Age-filter queries server-side with `active-workpapers-matters-search` `createdTo` / `editedTo`
  (ISO instants) rather than pulling all and filtering client-side.
- **Batch gets.** `active-workpapers-matters-get` / `-workpaper-records-get` / `-source-accounts-get`
  take an `ids` array — one call for N items, never a per-id loop.
- **Fetch once, thread forward.** Within a recipe, the open-query list, `BinderContext`
  (team/stats), and the sources manifest are fetched **once** at the earliest step that needs
  them and passed to later steps as caller-supplied input — no downstream refetch of the same
  data (each atomic skill accepts these inputs when provided).

## Artifacts pass by file once they're big

Inline JSON handoffs only below ~2–3 KB. Larger artifacts (a full binder's `FilingCandidate[]`
with snippets) are written to a session/scratchpad file by the producing
skill or subagent, which returns only `{ counts, per-need one-liners, filePath }`. The next
heavy consumer reads the file. This keeps recipe orchestration (inline) token-viable.

## Subagent pattern for heavy legs

The read-heavy discovery skill (`wp-intake-discover`, any anchor) is dispatched to the
**`wp-discover` agent** (Agent tool, `subagent_type: wp-discover`) for full-binder sweeps. The spawn
prompt must include: the skill file to read, the anchor and its inputs (`InformationNeed[]` inline or
by path, thread ref, window), the `BinderContext` inline, the resolved group member-entity
id/name/address set when in a group, the manifest path, the output artifact file path to write, and
the distilled return shape. Read-only is **tool-enforced** — the `wp-discover` allowlist carries no
write tools, so it cannot touch Workpapers/Documents; it returns candidates, and writes happen inline
behind the confirmation gate.

The same `wp-discover` worker also carries the **read-only front half** of the initial request per
binder (`info-needs` → `intake-discover(needs)` → `info-match`, "mode B") so that on a group /
multi-binder run the five binders' TB slices and candidate bodies stay inside per-entity workers
rather than accumulating in the orchestrator — see `wp-client-queries-initial-request` §"Group /
multi-binder scope". The first write (filing) always stays with the orchestrator, behind its gate.

## Server surface (`active-workpapers-*`)

The workpapers surface follows the `active-workpapers-*` contract and shares the platform
paging/search idioms with the Active core (`active-*`) surfaces. What skills rely on today:

- **Matters are one surface.** `active-workpapers-matters-search` / `-matters-get` / `-matters-apply`
  with `kind: ClientQuery | InternalNote` on both read and write — cover both queries and notes.
  Checklist items are **not matters** on this surface: `kind` accepts only those two values, and a
  checklist id is not found (omitted from search/get, 404 on messages). `matters-search` MUST be
  scoped: pass `binderId: [...]` (one or more binders — the result
  is **flat**, each row carrying its `binderId`) OR an involvement filter (`assignedToMe` /
  `createdByMe` / `combine` Or/And / `outstanding`). There is no firm-wide scan and no grouped-per-
  binder result. "My open queries across all clients" = `matters-search { assignedToMe: true,
  kind: "ClientQuery", outstanding: true }`.
- **Writes are batched + atomic.** `-matters-apply` / `-workpaper-records-apply`: `creates[]` +
  `updates[]`, validated up front, applied all-or-nothing, returning compact acks. A matter update's
  `post` (a plain **string**, ambient user) appends a conversation message and `postDocuments`
  attaches documents to it; pair with `status` for an atomic transition+provenance-note. A matter
  **create takes no `post`** — its substance goes in `description` (what the compile recipes render
  correspondence from); post an opening message with a follow-up update. `postDocuments` *is* available
  on a create, so a document can be filed against a brand-new note in the one atomic apply. Records are
  created as the default kind (no `recordType` on create). Unlink with `clearSection` /
  `clearSourceAccount` (records) / `clearAssignedTo` (matters); `flag` is `bool?` (set on/off).
- **Text is rich text, never markdown.** `description` (matters), `post` and `notes` (records) are
  **HTML**, sanitised on save to `div ul ol li a strong b i em u br span` (+ `href`/`target`/`style`,
  https links only). Anything else — markdown `**bold**`, `<p>`, `<h1>`–`<h6>`, tables, images — is
  stripped **silently**: the write returns 200 and the content lands mangled, so there is no error to
  correct against. Paragraphs are `<div>`; emphasis is `<strong>`/`<em>`. Limits: matter `title` 128,
  matter `description` 4000 (markup **not** counted), `post` 4000 (markup **counted**), record `title`
  64, record `notes` 512 (markup not counted). Titles are plain text.
- **Documents are `MeDocumentRef`.** Every attach (record `documents`/`attachDocuments`, matter
  `documents`/`attachDocuments`, `postDocuments`) is a `{ documentId XOR url, name, fileExtension? }`;
  `detachDocuments` removes by `hyperlinkId | documentId | url`. Attach is idempotent by
  documentId/url; attaching a **documentId** also links the doc to the binder.
- **Matter linkage is a single record.** A matter links one `workpaperRecordId` (or a `worksheetId`
  + `range`), not account/record/section arrays. Re-link on update (no un-link). The read side
  derives the matter's `account`/`section` through that record. To link a matter (or attach a
  document) to a source account **or** a section, use **`active-workpapers-binders-attach`** — it
  resolves or creates the intermediary record (0 ⇒ create, 1 ⇒ use, >1 ⇒ 422 with candidates).
- **Note type is two values.** A note is `ReviewPoint` (iff it requires an approver) or a plain
  `InternalNote`, on both create and read; queries have `noteType: null`. There are no other
  create-time presets.
- **Records scope + filters.** `active-workpapers-workpaper-records-search` requires a non-empty
  `binderId: [...]`; array filters `sectionId[]` / `sourceAccountId[]`; `systemStatus`, `recordType`
  (read/search only), `flag`, `reconciliation`, `classification`, `search`.
- **Composite orientation.** `active-workpapers-binders-get` + `panels` (see token-budget defaults).
- **Binder edits are narrow.** `active-workpapers-binders-update` is the only binder write besides
  `-binders-attach`, and it covers **name, description and people only** — the four role holders
  (`partnerId`/`managerId`/`reviewerId`/`preparerId`) plus extra team members via `addUsers`
  (`[{userId, canApprove?}]`) / `removeUsers`. PATCH semantics (omit ⇒ unchanged); team lists are
  **non-destructive**, so to swap someone out name them in `removeUsers` rather than re-listing the
  whole team. A role holder cannot also be a team member; only `description` is clearable. Status,
  dates, client, source and binder type are **not** writable — those still need the UI.
- **Shared platform idioms (both servers).** Paging is **1-based `page`/`pageSize`** (1–200, default
  50) returning `{ records, recordsCount, page, pages, pageSize }` — no `skip`/`take`, no `total`/
  `items`. `search` is **plain case-insensitive substring** — there is **no `matchMode`**; `*`/`?`
  wildcards are accepted **only** by `active-core-offices-search` / `active-core-users-search`. Date
  ranges are `createdTo` / `editedTo` (matters). Batch gets take an `ids` array. Writes return
  `{ id, changed }` acks.
- **`active-documents-documents-search` specifics.** Takes **exactly one** of `clientId`/
  `clientGroupId` — for a grouped client you **must** pass `clientGroupId`, since a `clientId`-scoped
  search of a grouped entity silently omits group-level and sibling documents (no error; see
  *Group-level correspondence & attribution*) — defaults `collapseEmailThreads=true` and a ~6-month modified window, array-valued
  filters (`cabinetId`/`typeId`/`statusId`/`tag`/`userId`/`partnerId`, `sortBy`) with `fileType` as a
  **category enum** (Word/Excel/PDF/Email/…), not a raw extension; list whole email threads with
  `active-documents-documents-thread-list`.
