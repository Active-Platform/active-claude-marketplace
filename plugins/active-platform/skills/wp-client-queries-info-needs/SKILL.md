---
name: wp-client-queries-info-needs
description: Building block for the client-queries recipes; identify what evidence a binder needs right now, flagging missing vs held vs already-requested. Invoke directly only for a standalone gap analysis.
kind: skill
user-invocable: false
---

# wp-client-queries-info-needs — what does this binder need?

Identify the information most likely required for a binder *right now* — which
accounts/sections, what kind of evidence, for which periods.

Two references work **together** as the basis, answering two different questions:

- **The current trial balance scopes the need set** — *which* needs exist now: accounts with
  balances, flags, unreconciled items, or missing records this period.
- **The prior-period binder grounds each need** — *what* each need's evidence should be, how
  complete a finished job looks for this client, and which recurring/anticipated needs to
  expect. It is the best predictor.

What each scoped account actually gets asked for is decided by the firm's **trial-balance review
policy** ([Trial-balance review policy](#trial-balance-review-policy), below). Resolution
precedence, high to low: **(a)** documents actually received from the client in the prior period
(recorded on `priorPeriodPrecedent`) → **(b)** the review policy → **(c)** the residual kind
mapping in the policy file for account kinds no rule covers.

**Inputs:** `BinderContext`, optional scope filter (classification / section / account).
**Output:** `InformationNeed[]` (`wp-ref-contracts`).
**Side-effects:** none. Read-only.

## Prior-period grounding (the primary basis, when available)

When a prior-period binder exists, last period's job is the template of "what a complete job
for this client looks like." Read two things from it:

1. **Filed records / evidence** — what evidence kind was obtained per account/section. Use it to
   (a) refine/override the policy-derived evidence kind per account; (b) surface recurring
   needs the current binder hasn't addressed; (c) sharpen descriptions ("same as the FY2025 bank
   confirmation"). Record the precedent on `priorPeriodPrecedent`.
2. **Internal notes** — the prior binder's notes (a `matters kind=InternalNote` panel in the call plan),
   scanning for flagged *future/anticipated* activity (acquisition, new loan, restructure,
   disposal planned "next year"). Also scan the **current** binder's notes for the same — a note
   raised this year about next-period activity is an equally valid trigger.

Precedent *grounds* a request; when the referenced account still exists it never fabricates a
duplicate. No prior binder → the review policy alone drives the asks; skip prior grounding
silently.

## Expected-absent needs (do NOT silently drop)

"Absent from the current TB" is ambiguous — an account can be genuinely closed, live-but-not-yet
posted (pending journals), or a future activity with no account in either period yet. **Always
surface it**; never auto-suppress. Two origins, both become an `expected-absent`, **section-scoped**
(no `sourceAccountId`) need — still a normal client query:

- **Prior account not carried forward** — present in the prior TB, absent from the current TB.
  Scope to the section/classification it sat under; set `priorPeriodPrecedent.priorAccountId` /
  `priorAccountName`. Description states it plainly: *"Rent expense was present in FY2025, not yet
  in the FY2026 TB — confirm whether pending or ceased."*
- **Flagged future activity** — from a prior/current internal note. Scope to the section the new
  account will land in; set `flaggedActivity` to the note. Description: *"Client flagged
  acquisition of X — need the sale contracts and completion accounts so goodwill/intangibles can
  be set up."*

Use a recurrence + materiality + statutory-nature heuristic only to set `priority` (recurring &
material ⇒ high; one-off ⇒ lower) — never to decide *whether* to surface. These needs will be
recorded as queries "stored in a section pending an account being created."

## Call plan (one panels call per binder — never sweep the full TB)

Token rules: `wp-ref-conventions`. An unfiltered Behemoth TB is
~114–200 KB; every slice below is a few KB. The orientation is **one
`active-workpapers-binders-get` with `panels`** (records + matters) on the current binder plus a few
**`active-workpapers-binders-trial-balance-get`** calls for the TB slices (the trial balance is no
longer a panel) — not a fan-out of list calls. The prior binder repeats the same shape when grounding runs.

1. **Current binder — ONE `active-workpapers-binders-get binderId=… panels=[…]`** for the records +
   matters slices (apply the caller's scope filter — `classification` etc. — inside each panel's params),
   plus the TB slices as separate `active-workpapers-binders-trial-balance-get` calls (always `slim=true`
   and filtered — never a whole-TB sweep). The binder detail
   carries the stats orientation (counts, per-classification subtotals) and `source` — a
   connected accounting system vs Excel/manual drives the policy's connected-ledger exception.
   Panels — `panels` is an **array of `{ kind, params }` objects**, so a repeated kind (×N below) is
   just repeated entries, e.g.
   `[{ kind: "records", params: { recordType: "DocumentPlaceholder" } }, { kind: "records", params: { reconciliation: "unreconciled" } }, …]`:
   - `active-workpapers-binders-trial-balance-get` ×3, `slim=true`: `unreconciled=true`; `flagged=true`;
     `hasRecords=false, leafOnly=true, includeZeroBalance=false` (scope each with `classification`).
   - `records` ×2: `recordType=DocumentPlaceholder`; `reconciliation=unreconciled` (slim rows).
     For any finance-liability account (lease / hire purchase / chattel mortgage), also note
     whether an amortisation/reconciliation `Worksheet` record already exists on it — the
     policy's ongoing-vs-new-loan rule turns on this. (Record types are `Worksheet | Standalone |
     StandaloneChecklist | DocumentPlaceholder | ActiveSheet`; `calc-schedule` is an evidence *kind*.)
   - `matters` ×2: `kind=InternalNote, resolved=Unresolved` — notes flagging anticipated activity raised
     this period; `kind=ClientQuery, outstanding=true, previewChars=0` →
     cross-reference: a need already covered by an open query is `status:"requested"` with
     `existingQueryId` set — never `missing`. **Hand this open-query list forward** to the recipe
     (query-record / status-review reuse it — fetch once, thread forward).
2. **Prior-period grounding (if available):** take `BinderContext.priorBinderId`, else resolve —
   `active-workpapers-binders-search clientId=… binderTypeIds=[same] statusIds=[Completed]`, pick the
   immediately-prior FY. Then **one** `active-workpapers-binders-get` on the prior binder with panels:
   `records` (slim rows keyed by account/`recordType` → the precedent map by account/section) and
   `matters kind=InternalNote` (flagged future activity), plus a separate
   `active-workpapers-binders-trial-balance-get slim=true leafOnly=true` call if account mapping is
   needed for the prior-vs-current diff.

The union of the TB slices (present-in-TB needs) plus the prior-vs-current diff and flagged notes
(expected-absent needs) is the candidate-needs set. For each candidate: apply the **review
policy** (below) to classify **provenance** and decide whether to ask at all and for what `kind`
(precedent first, then the policy, then its residual mapping), set `scope` (`sourceAccountId` when the
account exists, else `sectionId`/`classification`), `period` (binder FY), `tbPresence`
(`expected-absent` for the account-less origins above, else omit), a client-facing-quality
`description`, `existingRecordId` where a placeholder/unreconciled record exists, and rank
`priority` (high: material balances, flagged accounts, statutory items; low: small/zero-movement
balances).

## Trial-balance review policy

**What to ask the client for, and what not to**, is governed by the firm's editable policy — not
hard-coded here. Read it from `~/.claude/active-workpapers/review-rules.md`; if that file is
absent, use the shipped default in `wp-ref-review-rules` (load it with the Skill tool) and mention
the firm can run
`wp-setup` to install/edit its own. The policy keys off account name, **provenance** (who supplies
the evidence), ledger `source` (connected vs Excel/manual), materiality, the prior-period diff,
and existing worksheets — all already gathered in the call plan above — and its residual mapping
covers account kinds no rule addresses.

**Provenance gates what this skill emits.** It feeds the *client-query* flow, so it emits needs
only for the policy's `client` and `hybrid` classes:

- `client` → a normal `InformationNeed` (`provenance: "client"`).
- `hybrid` (e.g. construction WIP) → an `InformationNeed` with `provenance: "hybrid"`, phrased
  **open-ended** ("supply any information you have to help us calculate …"); `query-record` keeps
  that open-ended framing.
- `ledger` (from the accounting records, on a connected ledger) and `firm` (accountant-prepared —
  most tax, accruals, prepayments, FA schedules, related-party/intercompany balances) → **not
  emitted as needs.** Count them and report a one-line rollup ("N items handled internally / from
  the accounting records — not asked"), so they're visible as *considered-and-excluded*, not
  overlooked. Likewise the always-skips (minor cash, routine fixed-asset invoices).
- **Unclear provenance** → **do not ask.** Where it's genuinely ambiguous whether the client or
  the firm supplies an item, don't emit a client query on a guess; list it on a separate
  **"confirm who supplies (not asked — preparer to confirm)"** rollup line for a human to decide.

## Notes

- Skill, not agent: the panels plan bounds every payload even on the largest seed binder
  (Behemoth: 293 accounts / 197 records) and costs **one call per binder** (current + prior).
  **On a group / multi-binder run this executes inside the per-entity `wp-discover` read-half
  worker** (mode B — `wp-client-queries-initial-request` §"Group / multi-binder scope"), so five
  binders' slices stay in their own contexts rather than accumulating in the orchestrator.
- Output >~2–3 KB → write to a scratchpad file and return the rollup + path (conventions.md).
