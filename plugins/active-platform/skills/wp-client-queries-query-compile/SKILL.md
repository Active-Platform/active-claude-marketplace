---
name: wp-client-queries-query-compile
description: Building block for the client-queries recipes; from ALL the binder's outstanding queries (new + previously sent) render correspondence (email/letter) or a read-only table, in fresh/follow-up/mixed wording, and — on confirmed send — update statuses. Assumes statuses were reconciled upstream by wp-client-queries-query-status-review; it does not itself normalise statuses.
kind: skill
user-invocable: false
---

# wp-client-queries-query-compile — draft the client document

Draft a single client-facing artifact (email body or Word letter) from **all outstanding
queries** on a binder (or group) — not just the ready ones — and, only on the user's confirmed
send, update their statuses. Consumes the domain objects `wp-client-queries-query-record`
recorded; **does not itself create queries**. Also runs standalone over pre-existing recorded
queries (the `wp-client-queries-compile` recipe).

**Inputs:** `BinderContext` (or group scope), optional query-id filter, optional output-format
override (`email` | `letter` | `table` — otherwise the firm's `channel` preference for
correspondence), optional `newOnly` flag (exclude previously-sent items). **Output:** the compiled
document (or table) + a per-query status update. **Side-effects: outward-facing** (client document)
→ **always confirm**; then status writes (`wp-ref-conventions`). The
`table` mode is **read-only** — it lists the outstanding queries and makes no writes.

## Output modes & wording

- **Correspondence (default)** — `email` / `letter` per `channel`; the full draft below, behind the
  outward confirmation gate.
- **`table`** — a compact read-only list of the outstanding queries (title, status, linked accounts,
  age, last-message preview). No draft, no send, no status writes — the fast "what's still
  outstanding?" snapshot. Stop after presenting it.
- **Wording follows the query mix:** **fresh** (all new — a first ask), **follow-up** (all previously
  `Sent` — a reminder of still-outstanding items, listing days outstanding), or **mixed** (both, new
  vs previously-requested visibly flagged). A caller (e.g. R3's follow-up step) may force the
  follow-up flavour.
- **Ageing report** is produced by the **`wp-client-queries-file-and-followup` (R3)** recipe, not
  here — this skill just renders the reminder when R3 asks for one.

**Format follows firm preference.** Channel (email/letter), how asks are grouped, and how each
item renders come from the `queryCorrespondence` block of `preferences.json` — schema, defaults,
and resolution precedence in `wp-ref-query-preferences` (load it with the Skill tool). No
preferences file → use the shipped default (email · grouped by type · tickable checkboxes ·
new-vs-previous marked) and note the user can run `wp-setup` to set the firm's style. A headless
content sample rendered from that default is the **Example query content** section at the end of
this skill — match its shape (the channel wrapper and signature are added around it per
`channel`/`signatory`).

## What goes in the document — by status

Query lifecycle is `Created | ReadyToSend | Sent | InProgress | Resolved | Actioned`
(`wp-ref-conventions`).

- **`ReadyToSend`** — vetted, include.
- **`Sent`** — **recompile for completeness by default** (a reminder/chase for items already
  requested), tagged as *previously requested*. Drop only if the caller passed `newOnly`.
- **`Created` (not started) and `InProgress` (in progress)** — **not ready to send.** These should
  have been reconciled upstream by `wp-client-queries-query-status-review`. If any remain, never
  silently include or drop them — see the defensive check in step 2.
- **`Resolved` / `Actioned`** — answered / terminal. **Exclude** — re-asking for information
  already provided is wrong. Just report their count if any exist.
- **Looks-answered-but-still-open** — an open query (usually `Sent`) whose `conversationPreview`
  / message count shows a recent **inbound client response** that was never moved to `Resolved`.
  Including it would chase the client for something they've already answered. This is also
  `wp-client-queries-query-status-review`'s job; if one slips through, step 2 flags it rather than
  silently including or dropping it.

## Procedure

1. **Collect — all outstanding queries.** Reuse the reconciled open-query set
   `wp-client-queries-query-status-review` hands over when a recipe chained it (`wp-ref-conventions`
   — fetch once, thread forward); else `active-workpapers-matters-search kind=ClientQuery outstanding=true`
   (apply the caller's id filter) to get every open query — `Created | ReadyToSend | Sent | InProgress`,
   not just the ready ones. List items already include the derived `account` (slim
   {id,accountNo,accountName}, resolved through the query's linked record) and `conversationPreview`
   — draft without refetching accounts. For **group scope**, pass every binder in the group as `binderId: [...]` in **one** call
   (not one call per binder); the result is **flat** — each row carries its `binderId`, so group the
   `records` by `binderId` client-side and carry each binder's name as the entity. Compile **one document covering the related
   entities** (one client group → one contact), carrying each query's entity so step 3 can mark or
   group by it — don't fragment into a separate letter per entity, and never mix *unrelated* client
   groups.
2. **Defensive status check — expect statuses already reconciled.** Status normalisation lives in
   `wp-client-queries-query-status-review` (the recipes run it before this skill). Do **not** re-run
   that interactive reconciliation here. Only guard against items that slipped through unreconciled
   (called standalone, or the user declined a batch):
   - **Not ready to send** (`Created` / `InProgress`) and **looks-answered-but-still-open** queries —
     don't silently include or drop them. Note them in one short line (`title · status · section`)
     and point the user to `wp-client-queries-query-status-review` to reconcile, then proceed
     **excluding** the not-ready ones and **keeping** `Sent` (unless the user says otherwise).

   `ReadyToSend` and `Sent` with no answer signal need no check. Skip this step when nothing
   qualifies.
3. **Group & sequence — per firm `grouping` preference.** Default (`grouping: type`) groups asks
   by **information type** so like items sit together (all bank statements, then all invoice
   requests, then fixed-asset items, …). `grouping: entity` instead makes a section per entity,
   type within. Within each group order by priority. Then two orthogonal marks on every item:
   - **Entity (multi-entity jobs only).** When the document covers more than one entity, make
     each ask's entity clear using the client's **short, obvious name** — e.g. "Behemoth",
     "EmAy" — woven into the sentence or bolded inline, never an internal code/acronym in
     brackets. Only lengthen the short-hand when two entities in the *same* job would otherwise
     be ambiguous (e.g. an EmAy Pty Ltd and an EmAy Unit Trust in the same job → "EmAy Co" /
     "EmAy Trust" — still plain words, never letter-codes). Under `type` grouping this sits in
     the item text; under `entity` grouping the section header already disambiguates, so items
     need no further marking. A single-entity document needs no entity marking at all.
   - **Provenance.** Tag **new** (never sent) vs **previously requested** (`Sent`).
4. **Draft — per firm `itemStyle`, calling out new vs previously sent.** Render each ask on its
   own line in the firm's `itemStyle` — default `checkbox` (`- [ ]`, tickable), or `bullet` /
   `numbered`. One ask per line; each states what, the period, and any precedent phrasing ("as
   provided last year"). Follow the **Example query content** section below for shape.
   - **Account references.** Whenever an ask names a specific account, **bold** the account name
     and give its number in brackets, e.g. "**Payroll Account** (…1234)".
   - **Multi-account queries.** A query links a **single** record, so read the accounts it covers
     from its **body** (per `wp-client-queries-query-record`'s grouping of related small gaps into
     one matter, which lists every affected account in the body). When the body names more than one
     account, **don't** flatten it into a single line — render one non-checkbox intro sentence
     naming the group, then **one indented checkbox per account** underneath it, each bolding the
     account name and bracketing its number:
     ```
     Bank statements to 30 June 2026 for the following Behemoth accounts:
       - [ ] **Payroll Account** (…1234)
       - [ ] **Savings Account** (…5678)
     ```
     A single-account query stays a normal one-line checkbox — no separate intro sentence needed.
   - Unless `newOnly`, the document mixes new and previously-sent, so make that explicit: the
     intro states the request consolidates all outstanding items and includes **both new asks
     and a reminder of items already requested**, and every previously-sent item is visibly
     flagged — an inline tag ("*(previously requested)*") or a separate "Still outstanding from
     our last request" group. (`showProvenance: false` or `newOnly` suppresses this framing.)
   - **Email:** subject "`<Client>` — FY`<yy>` year-end: information required"; a short intro
     (who, engagement, why), the grouped asks, a response-by ask, sign-off from
     `BinderContext.team` per the `signatory` preference (manager/partner).
   - **Letter:** same content rendered to `.docx` via the **`docx` skill**, house style.
5. **Confirm — offer the mail-client draft, then the "mark as sent" gate.** Show the full draft.
   - **Offer to draft into the mail client (email channel only).** When `channel` is `email`, the
     manifest reports a draft-capable engine (`outlook-email.draft=true` —
     `wp-ref-sources`), **and** the firm's `emailDraft` preference is
     not `off` (`wp-ref-query-preferences`), recommend composing the request as a draft in
     the user's mailbox: *"I can drop this into your Outlook drafts for you to review and send —
     shall I?"* This is outward-facing → **confirm before creating**. On confirm, call the exposed
     compose/create-draft tool (subject, body, recipient from `BinderContext`) and keep the
     returned draft link for step 6. **Creating a draft is not sending** — nothing is dispatched
     and no status changes yet.
     - When the engine is **not** draft-capable (`outlook-email.draft=false` — as in this
       environment), the channel is `letter`, or `emailDraft` is `off`, skip the offer and present
       the email **inline** as before. This environment has **no send-capable tool**
       (`outlook-email.send=false`), so the skill remains **draft-only, confirm-to-send**.
   - **Then the "mark as sent" gate.** Ask the user to mark it sent — the confirmation *is* the
     explicit "mark as sent" action (a mailbox draft still awaits the user pressing send in their
     client; the status flip is theirs to confirm). Nothing is written before this.
     - When **any** included query is **not yet `Sent`** → prompt *"Mark these N queries as Sent?"*;
       on confirm every included query ends up `Sent`.
     - When **all** included queries are **already `Sent`** (a pure reminder/chase) → there is no
       status to change: say so — confirming records a short follow-up line on each, no transition.
6. **On confirmed send — ONE `active-workpapers-matters-apply` for every included query.** Each included
   query gets a short plain-language line posted to its thread (the `post` field — a message on the
   query's conversation, with a link to the email where applicable — the mail-client draft created
   at step 5 when one was); queries not yet `Sent` also transition to `Sent`:
   - **Not yet `Sent`** (`ReadyToSend`, plus any `Created`/`InProgress` the user promoted at
     step 2) → an `updates[]` entry with `status: "Sent"` **and** a `post` recording the send
     ("Sent in information request, 7 Jul 2026") — one atomic transition+line per query.
   - **Already `Sent`** → an `updates[]` entry with a `post` only ("Followed up 7 Jul 2026" + email
     link if applicable); status stays `Sent`.
   - Report the outcome from the acks uniformly as *marked `Sent`* when any changed status; when
     **all** were already `Sent`, report that a follow-up line was recorded with **no status change**.

## Notes

- Queries excluded from the document (user trimmed the draft, or declined a not-ready item at
  step 2) keep their status — report them as still `Created` / `ReadyToSend` / `InProgress`.
- `newOnly` caller flag: omit `Sent` items entirely and skip the new-vs-previous framing —
  the document is then purely new asks.
- Skill, not agent: output is small and the user must see it before it goes out.

## Example query content

The **body/content** of a compiled client information request, rendered from the shipped default
preferences (`wp-ref-query-preferences`): `grouping: type`, `itemStyle: checkbox`,
`showProvenance: true`.

This is deliberately **headless** — it shows only the internal content format. The channel
wrapper (email To/From/Subject and salutation, or the letter's letterhead), and the sign-off /
signature block, are added *around* this content per `channel` and `signatory` when the document
is actually produced. Focus here is the shape of the request itself.

The example is **multi-entity** — one document covering a client group's related entities
(Behemoth Industries and its trust, Behemoth Family Trust). What the shape demonstrates:

- Queries **grouped by information type** (all bank items together, all invoices together, …) so
  the client works one category at a time — not one long undifferentiated list.
- In a multi-entity job, **each ask names the entity it relates to using a short, obvious name**
  ("Behemoth Industries", "Behemoth Family Trust") woven into the sentence — never an internal
  code/acronym in brackets. A single-entity job drops the naming entirely.
- Each ask on its **own line as a tickable checkbox** (`- [ ]`), phrased as a specific,
  answerable request stating *what* and the *period* it covers. Any account named in an ask is
  **bolded** with its account number in brackets, e.g. "**CBA business cheque account** (…4821)".
- A query that **bundles several accounts into one matter** (e.g. all remaining bank statements)
  renders as one plain intro sentence naming the group, followed by **one indented checkbox per
  account** — never flattened into a single line listing every account.
- **New vs previously-requested** made explicit — a one-line lead-in, plus every previously-sent
  item tagged inline so the client sees what is a reminder rather than a fresh ask.
- A clear **response-by** ask at the end.

Field values (entities, accounts, periods) come from the `BinderContext` / group scope and the
recorded queries at compile time — the text below is illustrative.

---

We've started work on the 30 June 2025 financial statements and income tax returns for **Behemoth
Industries** and the **Behemoth Family Trust**, and need the items below to finish the file. A few
were requested earlier and are still outstanding — those are marked **(previously requested)**.
Where you provided something similar last year, the same format is fine.

**Bank & cash**

- [ ] Behemoth Industries — June 2025 bank statement for the **CBA business cheque account**
      (…4821), showing the closing balance at 30 June 2025.
- [ ] Behemoth Industries — closing statement to 30 June 2025 for the **NAB term deposit**
      (…7730) — balance and accrued interest. **(previously requested)**
- [ ] Behemoth Family Trust — bank statements to 30 June 2025 for the following accounts:
  - [ ] **Cash-management account** (…9002)
  - [ ] **Foreign-currency account** (…9014)

**Sales & receivables**

- [ ] Behemoth Industries — aged receivables (debtors) listing as at 30 June 2025.
- [ ] Behemoth Industries — copy invoices for the three largest sales in June 2025 (we'll confirm
      which once we have the ledger detail).

**Purchases & payables**

- [ ] Behemoth Industries — aged payables (creditors) listing as at 30 June 2025.
- [ ] Behemoth Industries — tax invoice for the equipment purchase coded to *Plant & Equipment* on
      12 May 2025 ($18,400) — as provided for prior-year additions. **(previously requested)**

**Distributions & trust**

- [ ] Behemoth Family Trust — signed trustee resolution for the 30 June 2025 distribution of trust
      income.
- [ ] Behemoth Family Trust — confirmation of the beneficiaries and their distribution percentages
      for the year.

**Tax & other**

- [ ] Behemoth Industries — details of any government grants or support received during the year.
- [ ] Behemoth Industries — logbook or business-use percentage for the vehicle (Ranger) if the
      basis has changed from last year.

Could you send these through by **Friday 25 July**? If anything above is unclear or no longer
applies, just let us know.

---

### Alternative — `grouping: entity`

Same asks, same items, but organised as a section per entity (type within). Use when the firm
prefers the client to work entity-by-entity rather than category-by-category:

**Behemoth Industries**

- [ ] June 2025 bank statement for the **CBA business cheque account** (…4821)…
- [ ] Closing statement to 30 June 2025 for the **NAB term deposit** (…7730)…
      **(previously requested)**
- [ ] Aged receivables (debtors) listing as at 30 June 2025.
- [ ] … *(remaining Behemoth Industries items)*

**Behemoth Family Trust**

- [ ] Bank statements to 30 June 2025 for the following accounts:
  - [ ] **Cash-management account** (…9002)
  - [ ] **Foreign-currency account** (…9014)
- [ ] Signed trustee resolution for the 30 June 2025 distribution of trust income.
- [ ] Confirmation of the beneficiaries and their distribution percentages for the year.
