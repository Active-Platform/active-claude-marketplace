---
name: wp-client-queries-info-match
description: Building block for the client-queries recipes; decide per need whether the discovered candidates actually satisfy it (found/partial/not-found) and route the satisfied subset to filing, the unmet subset to query-record.
kind: skill
user-invocable: false
---

# wp-client-queries-info-match — need vs found

Decide, per need, whether the candidates `wp-intake-discover` proposed actually satisfy it. Pure
reasoning over already-distilled artifacts — **stays inline** so its decisions are visible and
auditable.

**Inputs:** `InformationNeed[]` + the `FilingCandidate[]` from `wp-intake-discover` on the `needs`
anchor (`wp-ref-contracts`) — read from their artifact files when passed
by path. **Output:** `MatchResult[]` (the per-need verdict) + the confirmed `FilingCandidate[]` to
file. **Side-effects:** none.

## Scope — the need-linked subset only

Adjudicate only candidates that carry a `needId` (discovery's targeted catch). **Incidental**
candidates (no `needId` — the broad-net catch: general correspondence, docs for accounts with no raised
need) **bypass match** and go straight to `wp-intake-file`; they have a home, not a need to satisfy.

## Procedure

1. **Group candidates by `needId`** and compare each need against its candidate(s) on: period coverage
   (statement dates vs the need's `period`), account/scope fit, amount consistency where visible,
   document type vs the need's `kind`, and each candidate's `confidence`.
2. **Classify** each need:
   - `found` — at least one candidate fully satisfies the need for the whole period.
   - `partial` — real evidence, but incomplete (part of the period, one of several accounts, a pointer
     rather than the document itself).
   - `not-found` — no candidate is plausible.
3. **Pick the best candidate(s)** per need (fewest items that give full coverage) and **explain the
   call** in `rationale` — one or two sentences a reviewer could audit. Candidates not picked are
   dropped from the file batch.
4. **Confirm/override the home** discovery proposed on the kept candidates: the need's `existingRecordId`
   is the primary anchor; a document spanning several accounts follows the multi-account schedule
   convention in `wp-ref-conventions`. Discovery already set
   `proposedTarget` — only override when the need makes a better home obvious.
5. **Borderline calls only — confirm by opening.** When a kept candidate's fit is genuinely
   uncertain and it matters, open the source to confirm per the shared rule
   (the *Confirm-by-opening (document inspection)* section of `wp-ref-conventions`):
   cheapest method first — `read_resource` for M365 items, `active-documents-documents-get` for a
   specific Active document (the single-doc exception to the bulk-triage ban) — under the same
   per-sweep cap. **Record it** in the candidate's `inspection` marker (`opened`/`method`/`note`)
   so a match-driven open also shows in the filer's list.

## Downstream

- `found`/`partial` need-linked candidates **+ all incidental candidates** → `wp-intake-file`.
- `not-found` + `partial` needs → `wp-client-queries-query-record` (partial items get asked for the
  *missing remainder* — say what we already hold in the query body).
