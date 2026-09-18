---
name: wp-ref-review-rules
description: Reference — the shipped default trial-balance review policy (evidence provenance classes and the ask/don't-ask rules) behind ~/.claude/active-workpapers/review-rules.md. Loaded by wp-client-queries-info-needs and wp-setup via the Skill tool; not a standalone task.
kind: skill
user-invocable: false
---

# Trial-balance review policy — what to ask the client for (and what not to)

Firm-editable policy that drives `wp-client-queries-info-needs` when it decides what evidence a
binder needs. These rules are **chosen, not probed** — a firm edits them in plain English to
match how *they* work. They live in a user-level file that survives a capability refresh:

```
~/.claude/active-workpapers/review-rules.md
```

`wp-setup` copies this shipped default there on first run (and on `wp-setup --rules`); after that
it's yours to edit. `wp-setup --refresh` re-probes connectors only and never touches this file.

## How the skill uses this file

The rules below are applied by judgement, per account or account group, using signals the skill
already gathers:

- **Account name** — the account chart isn't standardised and `accountType` is usually blank, so
  rules match on the **name** (e.g. "Hire Purchase", "Undeposited Funds", "Inventory").
- **Provenance** — *who supplies the evidence* (see the next section). This decides whether the
  item is a **client ask** at all.
- **Ledger `source`** — `BinderContext.source` (`apiType` + `viaActiveLedger`). A *connected*
  accounting system (Xero, QBO, MYOB, Reckon, …) means the subsidiary ledgers can be pulled
  directly; **Excel / manual** files cannot, so more is asked of the client.
- **Materiality** — the account's balance relative to the file; small/immaterial balances are
  treated differently from large ones.
- **Prior-period diff** — whether an account existed in the prior binder/TB (ongoing vs new).
- **Existing workpapers** — whether the binder already holds a workpaper (e.g. an amortisation /
  reconciliation `Worksheet`) that makes a client request unnecessary.

**Precedence:** documents actually **received from the client in the prior period take
precedence** over these rules — if last year's file already tells us what a good answer looks
like, that grounds the request. These rules decide what to *expect* where prior evidence doesn't
already answer it, and apply **with or without** a prior binder.

## Who supplies the evidence (provenance) — decides whether we ask the client

Every candidate need is one of four provenance classes. **Only `client` and `hybrid` become
client queries.** `ledger` and `firm` items are *deliberately excluded* from the client ask —
considered and recorded as handled elsewhere, not overlooked, and never emitted as client
queries.

- **`client`** — only the client can supply it. Bank statements, loan/finance confirmations, new
  lease/HP agreements, inventory stocktake/valuation. → **a client query.**
- **`ledger`** — comes from the primary accounting records. Debtors, creditors, bank
  reconciliations, payroll, and often inventory movements. → **not** a client ask **when the
  ledger is connected** (Xero/QBO/MYOB/etc.); on an **Excel / manual** file these fall back to
  `client` and *are* asked.
- **`firm`** — the accountant prepares it or already has access. Most tax (GST, PAYG, BAS/IAS via
  the portal and lodged forms), accruals, prepayments, depreciation / fixed-asset schedules, and
  related-party / intercompany balances the firm reconciles internally. → **not** a client ask —
  *unless* there is evidence the client maintains the item independently, in which case it
  becomes `client`.
- **`hybrid`** — needs both client input and an accountant calculation (e.g. construction work in
  progress). → an **open-ended** client query ("supply any information you have to help us
  calculate construction WIP") *plus* the accountant's own calculation.

**When provenance is genuinely unclear** (e.g. accruals/prepayments/FA schedules the client
*might* maintain, or a borderline account), **default to NOT asking** — do not send a client
query on a guess. Instead flag the item for the preparer to confirm who supplies it (it appears in
the skill's "confirm who supplies" review line). A client ask only goes out once a human confirms
it belongs with the client.

## Rules (what to ask, and when)

1. **Bank & external loans — `client`, almost always requested.** Ask for period-end bank
   statements/confirmations and loan/finance statements/confirmations from **external** lenders.
   (Loans/balances with **related parties in the same group** are not this rule — see rule 9.)
   - *Exception (ongoing finance liabilities):* a lease / hire purchase / chattel mortgage that
     was **present in the prior period** does **not** need its source documents again **if** an
     amortisation/interest **worksheet** has already been prepared (an existing `Worksheet` record
     on that account/section). If no such worksheet exists yet, still request the starting
     documents.

2. **New leases / hire purchase / chattel mortgages — `client`, almost always request source
   docs.** A finance liability present **this** year but **absent from the prior period** is new:
   ask for the agreement / source documents so the loan and interest amortisation can be
   calculated.

3. **Minor cash accounts — do NOT ask.** Undeposited funds (already tracked in the client ledger)
   and cash on hand / petty cash / float (usually immaterial) have **no bank statements** to
   request — skip them by default.
   - *Only* raise a **low-priority, confirmatory** `client` need when the balance is **materially
     large** — e.g. "please confirm the cash-on-hand balance of $X looks correct".

4. **Sub-systems (debtors, creditors, payroll, bank recs, inventory) — mostly `ledger`.** On a
   **connected** ledger these come from the accounting records — do **not** ask the client for
   debtors, creditors, payroll or bank recs. On an **Excel / manual** file they are `client` —
   request the reports (aged debtors, aged creditors, payroll summary/STP/super).
   - **Inventory is the exception:** the stocktake / stock-system valuation is a `client` ask
     **even on a connected ledger** (the accounting ledger can't produce a physical count).

5. **Fixed assets — `firm`, do NOT ask for purchase invoices by default.** The asset register /
   transaction listing already carries the core detail. Only raise a `client` need when something
   **unusual** is evident — e.g. a large flagged or unreconciled addition or disposal.

6. **Tax accounts (GST, PAYG, BAS/IAS, income tax) — `firm`, NEVER ask the client** unless
   specifically requested. The accountant prepares the workings and has portal / lodged-form
   access, so these are never a client query by default — only raise one if the preparer has
   explicitly asked for it.

7. **Accruals, prepayments, depreciation / fixed-asset schedules — `firm`.** Almost always
   prepared by the accountant. Only becomes a `client` ask where there's evidence the client
   maintains the schedule independently — and where that's **unclear**, don't ask: flag it for
   the preparer to confirm (per the "when provenance is genuinely unclear" rule above).

8. **Hybrid items (e.g. construction work in progress) — `hybrid`.** Raise an **open-ended**
   client query for whatever supporting information the client holds, alongside the accountant's
   own calculation.

9. **Related-party / intercompany balances — `firm`, do NOT ask.** Intercompany receivables and
   payables, and loans between entities in the same group (e.g. "Intercompany Receivable",
   "Loan Receivable", "Loan from Jackson Family Trust"), are reconciled **internally** — the firm
   prepares **both sides** of the group, so no client confirmation is needed.
   - *Exception:* where the counterparty is **outside** the firm's client group (the firm does not
     prepare the other side), treat it like an external loan under rule 1 — request a confirmation.

## Residual mapping (client-asked kinds no rule above covers)

Fallback evidence kind, by account signal, for **client** items the rules don't specifically
address (`firm`/`ledger` items are not asked, so are not listed here):

| Account signal | Expected evidence `kind` |
|---|---|
| Bank / cash at bank / term deposit | `bank-statement` |
| Trade debtors / receivables (Excel/manual file) | `reconciliation-support` (aged debtors, subsequent receipts) |
| Trade creditors / payables (Excel/manual file) | `reconciliation-support` (aged creditors, supplier statements) |
| Loans — **external / outside the group** (related-party in-group → rule 9, not asked) | `confirmation` (loan statement/agreement, balance confirmation) |
| Inventory | `reconciliation-support` (stocktake listing, valuation basis) |
| Anything flagged/unreconciled with no obvious type | `other` (describe from the account name) |

## Editing this file

Rewrite, add, or delete rules to match your firm's approach — they're read as guidance, so plain
English is fine. Keep each rule about *one* decision (who supplies it; ask / don't ask, and when),
and name the account kinds it applies to so the skill can match them.
