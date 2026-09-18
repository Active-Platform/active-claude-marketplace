---
name: wp-ref-contracts
description: Reference — JSON handoff shapes for the wp-* Workpapers skill suite (BinderContext, InformationNeed, FilingCandidate, MatchResult, FiledArtifact, RecordedQuery). Loaded by wp-* skills via the Skill tool; not a standalone task.
kind: skill
user-invocable: false
---

# Data contracts — JSON handoff shapes

Stable JSON artifacts exchanged between `wp-*` skills. Skill N's output is skill N+1's input;
**every skill validates the artifact it receives** (required fields present, enums in range,
`binderId` matches the active `BinderContext`). Artifacts >~2–3 KB pass by file, not inline —
see `wp-ref-conventions`.

`BinderContext` is shared by all areas. `FilingCandidate` / `FiledArtifact` are owned by the
shared `intake` capability. Each future area (review-points, advice, …) extends this file with
its own types rather than forking the pattern.

## `BinderContext` — universal entry artifact

Produced by `wp-binder-resolve`. Every other skill requires one. On **group scope** (a named group /
`clientGroupId` hint) `wp-binder-resolve` emits a **`BinderContext[]`** — one per in-scope entity
binder — and downstream skills iterate it; see the *Job-type scope for wp-binder-resolve* section of
`wp-ref-recipes`.

```jsonc
{
  "binderId": "b2000000-0000-0000-0000-000000000001",
  "clientId": "9b7e4d2a-…",
  "clientName": "Behemoth Pty Ltd",
  "clientGroupId": "…",            // optional
  "clientGroupName": "Jackson Family Group",  // optional
  "binderType": "Company Financial Statements & Tax",
  "status": "InProgress",
  "jurisdiction": "AU",
  "financialYearStartDate": "2025-07-01",
  "financialYearEndDate": "2026-06-30",
  "priorBinderId": "…",            // optional — immediately-prior-period binder of the SAME
                                   // binder type, set by wp-binder-resolve; unset for
                                   // first-year clients. Grounding input for info-needs.
  "readOnly": true,                // optional — set by wp-binder-resolve when this binder is a
                                   // PRIOR-YEAR BASIS for a requested year that has no binder of its
                                   // own (the requested year is Completed / absent, only last year
                                   // exists). binderId/columns/TB here are LAST year's — the template
                                   // to derive this year's request from. Downstream skills may READ
                                   // it but MUST NOT write: no ClientQuery recorded, nothing filed;
                                   // output is a drafted request only. Absent/false = normal writable.
  "readOnlyReason": "no FY2026 binder — based on FY2025",  // optional — set with readOnly; names the
                                   // requested year that has no binder, for the recipe's report line.
  "columns": [{ "id": "…", "name": "FY2026" }],
  "source": {                      // primary-column data origin; also on binder_list rows now
    "id": "…",                     // source-connection id (raw)
    "name": "Xero connection",     // source-connection display name (raw)
    "apiType": "Xero",             // raw ApiType enum name (machine token): "Xero","Bgl360",
                                   // "Excel","Unspecified"… A binder with no live connection
                                   // (hand-entered / spreadsheet TB) is "Excel"/"Unspecified" —
                                   // not a live feed, treat the TB as a snapshot.
    "viaActiveLedger": true,       // true when the binder connects through Active Ledger
    "label": "Active Ledger + Xero"  // ready-to-display string; the "Unspecified" apiType reads as
                                   // "Manual" here ("Excel", "Manual", "Xero", "Active Ledger + Xero")
  },                               // null only for legacy binders with no source seeded
  "engagement": {                  // binder-get only — engagement metadata (lightened projection)
    "taxYear": 2026,
    "accountingMethod": "Accrual",
    "depreciationMethod": "Diminishing Value",
    "baseRateEntity": true,        // entity flags present ONLY when true (omitted when false)
    "smallBusinessEntity": true    // frequency / gstAccountingBasis are dropped from the MCP surface
  },
  "team": {                        // {id,name} pairs from active-workpapers-binders-get — carried so
    "partner": { "id": "…", "name": "…" },   // query-record has assignee defaults and
    "manager": { "id": "…", "name": "…" },   // query-compile has a signatory without re-fetch
    "preparer": { "id": "…", "name": "…" },
    "reviewer": { "id": "…", "name": "…" }
  }
}
```

## `InformationNeed` — produced by `wp-client-queries-info-needs`

```jsonc
{
  "needId": "need-001",            // stable within the run; used to key discovery candidates / MatchResult
  "binderId": "…",
  "scope": { "sourceAccountId": "…", "sectionId": "…", "classification": "Assets" },  // ≥1 set —
                                   // sourceAccountId is OMITTED for an expected-absent need (no account
                                   // exists yet); such a need is scoped to sectionId/classification.
  "kind": "bank-statement | reconciliation-support | invoice | confirmation | calc-schedule | other",
  "period": { "from": "2025-07-01", "to": "2026-06-30", "fy": "FY2026" },
  "description": "…",              // human-readable, client-facing quality
  "priority": "high | med | low",
  "provenance": "client | hybrid",  // who supplies the evidence. Emitted needs are only "client"
                                   // (a specific client ask) or "hybrid" (open-ended client ask +
                                   // accountant calc). "ledger" (from the accounting records) and
                                   // "firm" (accountant-prepared) items are NOT emitted as needs —
                                   // info-needs summarizes them as handled-elsewhere. See the
                                   // trial-balance review policy (wp-ref-review-rules).
  "status": "missing | partially-held | requested",
  "tbPresence": "present | expected-absent",  // optional, default "present" (omit for normal
                                   // needs). "expected-absent" = expected this period but not in
                                   // the current TB — a prior account not carried forward (maybe
                                   // pending journals) or a flagged future activity. Surfaced, not
                                   // dropped; still a normal client query, scoped to a section.
  "existingQueryId": "…",          // set when status=requested — the open query covering this
  "existingRecordId": "…",         // set when a (placeholder/unreconciled) record exists
  "priorPeriodPrecedent": {        // optional — what satisfied this same scope last period
    "priorBinderId": "…", "recordId": "…", "kind": "bank-statement", "note": "same as the FY2025 bank confirmation",
    "priorAccountId": "…", "priorAccountName": "…"  // optional — the prior-period account this
                                   // refers to; set for an expected-absent "account not carried
                                   // forward" need so downstream can name it.
  },
  "flaggedActivity": {             // optional — set for an expected-absent need raised by a note
    "binderId": "…", "noteId": "…", "note": "client flagged acquisition of X — will need goodwill/intangibles"
  }
}
```

## Discovery output — `wp-intake-discover` emits `FilingCandidate[]` (all anchors)

`wp-intake-discover` is the single discovery skill; it emits `FilingCandidate[]` (below) for every
**anchor** (`held` | `needs` | `queries` | `thread`). There is no separate search-result type — a
candidate carries its proposed home from the moment it is discovered. Anchor-specific fields: `needId`
is set on the `needs` anchor (need-linked candidates; incidental candidates omit it); `relatedQueryId`
is set whenever the item answers an open query (the primary signal on the `queries`/`thread` anchors).
*(The former `SourceMatch` type was retired in the 2026-07-10 discovery consolidation — it was a
`FilingCandidate` without a home.)*

## `MatchResult` — produced by `wp-client-queries-info-match` (over discover's need-linked candidates)

```jsonc
{
  "needId": "need-001",
  "decision": "found | partial | not-found",
  "matches": [ /* the need-linked FilingCandidate(s) that satisfy it, best first */ ],
  "rationale": "…"
}
```

## `FilingCandidate` — the ONLY input to `wp-intake-file`

Produced by `wp-intake-discover` (all anchors) — the single discovery artifact. `needId` is set on the
`needs` anchor's need-linked candidates; `relatedQueryId` on any item that answers an open query.
`wp-client-queries-info-match` may confirm/override the home on the need-linked subset before filing.

```jsonc
{
  "candidateId": "cand-001",
  "needId": "need-001",            // optional — preserved for FiledArtifact traceability
  "relatedQueryId": "…",           // optional — set by wp-intake-discover when the item answers an
                                   // open query; the RECIPE routes such candidates through
                                   // wp-client-queries-query-advance after filing.
                                   // wp-intake-file itself IGNORES this field (stays query-blind).
  "source": "outlook | sharepoint | teams | active-documents | fyi",
  "ref": "…",
  "title": "…",
  "date": "…",                     // optional
  "documentId": "…",               // set when already an Active document
  "proposedTarget": {              // the RECORD home — may be empty/omitted when the home is an
                                   // internal note (relatedNoteId / proposedNote below)
    "sourceAccountId": "…", "sectionId": "…", // ≥1 of account/section
    "recordId": "…",                          // set when an existing record is the target
    "createNewRecord": false                  // records are created as the default kind (no recordType)
  },
  "relatedNoteId": "…",            // optional — the home is an EXISTING internal note: attach the
                                   // document to it via a message hyperlink (proposedTarget empty).
  "proposedNote": {                // optional — the home is a NEW internal note: create it, then attach
    "noteType": "InternalNote",    // intake creates plain InternalNotes only — never ReviewPoints
    "title": "…", "description": "…",         // description optional
    "sourceAccountId": "…", "sectionId": "…"  // optional parent to link the note to via
                                              // active-workpapers-binders-attach (resolves/creates a
                                              // record and sets the note's workpaperRecordId). At most one.
  },
  "classification": "Assets",      // optional
  "confidence": 0.8,
  "rationale": "…",
  "inspection": {                  // optional — how the home/identity was established; defaults
                                   // (omitted) to metadata-only, not opened. See wp-ref-conventions
                                   // (confirm-by-opening).
    "opened": false,               // true when the document body was opened to confirm
    "method": "metadata-only | snippet | read_resource | documents-get | fetch",
    "note": "…"                    // optional — what opening confirmed (e.g. "body names
                                   // Behemoth FY2026 bank statement")
  },
  "duplicateOfDocumentId": "…"     // optional — set when dedup found it already filed
}
```

A candidate's **home** is exactly one of: `proposedTarget` (a record), `relatedNoteId` (an existing
internal note), or `proposedNote` (a new file-note). `relatedQueryId` is **additive** on top of any
home (advance the query the item answers). `wp-intake-file` writes both records **and** internal
notes — internal notes have no client-facing lifecycle, so they belong to the internal filer; the
client-query epilogue stays exclusively in `wp-client-queries-query-advance`.

## `FiledArtifact` — produced by `wp-intake-file`

`needId` set when needs-driven, `candidateId` when holdings-driven (both may be present).

```jsonc
{
  "needId": "need-001",
  "candidateId": "cand-001",
  "action": "attached | created-record | created-document | new-version | created-note | posted-to-note",
  "recordId": "…",
  "matterId": "…",                 // set for note targets (created-note / posted-to-note)
  "documentId": "…",
  "inspection": { … },             // echoed from the FilingCandidate so the recap shows whether/
                                   // how the item was opened without re-deriving. See wp-ref-conventions.
  "note": "…"
}
```

## `RecordedQuery` — produced by `wp-client-queries-query-record`

`matterId` is always set — the query is a recorded domain object, not a draft.

```jsonc
{
  "needId": "need-001",
  "matterId": "…",
  "title": "…",
  "body": "…",
  "workpaperRecordId": "…",        // the record the query links (null when account-less); the
                                   // read side derives the account/section through it
  "status": "Created | ReadyToSend",
  "reusedExisting": false
}
```

## Reconciliation report — produced by `wp-intake-discover` (`queries` anchor)

The `queries` anchor's per-query judgement of what still needs filing (its tagged candidates feed
`wp-intake-file` + `wp-client-queries-query-advance`; `replyFound: false` feeds the follow-up step):

```jsonc
[{ "queryId": "…", "title": "…", "replyFound": true, "alreadyFiled": false,
   "routedToFiling": true, "replyRef": "…", "note": "…" }]
```

## Server enums these contracts pin to

Query lifecycle `Created|ReadyToSend|Sent|InProgress|Resolved|Actioned` (**`Actioned` is
terminal** — treat like `Resolved`); record `systemStatus`
`Created|InProgress|ReworkRequired|ClientQuery|ReadyForReview|Approved|Complete`;
`reconciliationOption` `Field|Value|External|ActiveSheet`; record types
`Worksheet|Standalone|StandaloneChecklist|DocumentPlaceholder|ActiveSheet` (search/read only, not a
create param); note types `ReviewPoint|InternalNote`. See `wp-ref-conventions`.
