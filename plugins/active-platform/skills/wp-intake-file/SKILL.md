---
name: wp-intake-file
description: Building block (shared intake capability) — the one canonical filer that lands documents on their right internal home (a binder record/account, or an internal note) from FilingCandidate[]. Invoke directly only when candidates are already in hand.
kind: skill
user-invocable: false
---

# wp-intake-file — the canonical filer

The **one** skill that puts a document onto its right **internal home** — a binder record/account,
or an internal note. Every flow that files — the discovery sweep (`wp-intake-discover`, any anchor),
its needs-path verdict (`wp-client-queries-info-match`), and future `review`/`prepare` areas — reaches
filing through this skill. No other skill writes records, documents, or internal-note attachments.
It also owns the **post-filing recap** — the after-the-fact summary of what it filed and why.

**Input (the only contract):** `FilingCandidate[]` + `BinderContext`
(`wp-ref-contracts`). **Output:** `FiledArtifact[]`.
**Side-effects: writes** (documents, records, internal notes) → **batch-confirm** before applying
(`wp-ref-conventions` — confirmation policy).
Requires `active-documents.write` in the manifest; without it, placeholder-only mode (below).

Each candidate has exactly one **home**: a record (`proposedTarget`), an existing internal note
(`relatedNoteId`), or a new file-note (`proposedNote`). Internal notes have **no** client-facing
lifecycle, so this internal filer owns them. It stays **query-blind**, though: it ignores
`relatedQueryId` — the client-query epilogue (post the answer, advance status) belongs exclusively to
`wp-client-queries-query-advance`, never grow it here, because this filer is reused by areas that
have no client queries.

## Procedure

Per candidate, in two planned passes — plan everything, confirm once, then apply:

1. **Validate.** Candidate has a home (a `proposedTarget` with ≥1 of `sourceAccountId`/`sectionId`,
   **or** a `relatedNoteId`, **or** a `proposedNote`) and either a `documentId`
   or a `ref`+`source` to transfer. Skip (and report) candidates carrying `duplicateOfDocumentId`
   unless the user overrides.
2. **Resolve the target — by home type:**
   - **Record home** (`proposedTarget`) — `active-workpapers-workpaper-records-search binderId=[…]
     sourceAccountId=[…]` (slim rows — not `active-workpapers-source-accounts-get`): reuse the existing
     per-account record when one exists (**one-record-per-account**); honour an explicit
     `proposedTarget.recordId`; plan a record create only when `createNewRecord=true` or no record is
     obvious. For a document spanning several accounts, follow the multi-account schedule convention in
     conventions.md (need's record → section-level record → header account; one home only).
     **Confirm dedup from the list:** slim rows carry `documentIds:[…]` (S8) — if the candidate's
     `documentId` already appears in the target row's `documentIds`, mark `duplicateOfDocumentId`
     and plan a skip (report it; no `active-workpapers-workpaper-records-get` needed).
   - **Existing-note home** (`relatedNoteId`) — the note is the target matter; plan a matter
     update whose `postDocuments` carries the document (a `MeDocumentRef` — `{ documentId, name }`),
     with an optional `post` message. **Dedup:** check the note's conversation
     (`active-workpapers-matters-messages-list matterId=…`) for a hyperlink to the same `documentId`; if
     present, plan a skip.
   - **New-note home** (`proposedNote`) — plan a matter create (`kind='InternalNote'`,
     `noteType='InternalNote'` — its `title`/`description`) with the
     attaching document inline as `postDocuments`. If the note carries an account/section parent
     (`proposedNote.sourceAccountId`/`sectionId`), plan an `active-workpapers-binders-attach` (that parent
     + `matterId`) to link it to a record — matters no longer take account/record arrays.
3. **Ensure the document exists in Active Documents.** If `documentId` is set, nothing to do.
   Otherwise follow the cross-server transfer convention (conventions.md): `sourceUrl` create →
   upload-PUT flow → `DocumentPlaceholder` fallback (source ref in `notes`, flagged for human
   upload). Use `active-documents-document-versions-create` when the candidate is a new version
   of an existing document. (Applies to note homes too — a note attachment is still an Active
   document, linked by hyperlink.)
   **Versioning needs an Active Documents licence.** A Workpapers-only firm can search, read, create,
   update and link documents but cannot add a version, so `active-documents-document-versions-create`
   is not on its surface. File the candidate as its own new document instead, say in the recap that it
   was filed alongside rather than as a new version of the existing one, and carry on — this is a
   narrower home, not a failure.
4. **Confirm the batch.** Present one table: candidate title → target (account/record — existing vs
   new — or note — existing vs new file-note) → action (attach / create-record / create-document /
   new-version / create-note / post-to-note / placeholder / skipped-duplicate) → **Opened?** (the
   candidate's `inspection` marker — `✓ <method>` when opened to confirm, `– metadata-only`
   otherwise; `wp-ref-conventions` — confirm-by-opening). One
   confirmation for the whole batch.
5. **Apply — two batched applies (plus one `active-workpapers-binders-attach` per account-scoped new note).**
   - **One `active-workpapers-workpaper-records-apply`** for every record home: `updates[]` with
     `attachDocuments` (each a `MeDocumentRef` `{ documentId, name }`; server-side **idempotent by
     `documentId`/`url`**) for existing records, `creates[]` (with `documents` inline) for new ones — a
     create must link a section or an account. Set a reconciliation amount only as a **manual value**
     sourced from the document itself (e.g. a bank statement's closing balance) — never toggle an
     Excel-linked record or copy the trial-balance figure (`reconciliationOption` rules in conventions.md).
   - **One `active-workpapers-matters-apply`** for every note home: `creates[]` for `proposedNote`s
     (`kind='InternalNote'`, document inline as `postDocuments`) and `updates[]` of
     `{ matterId, post: "…", postDocuments: [{ documentId, name }] }` for existing notes. A
     post is **not** idempotent (it appends), so honour the step-2 dedup and don't re-post a
     `documentId` the note already carries.
   - **`active-workpapers-binders-attach`** once per new note that has an account/section parent — link the
     just-created `matterId` to a record on that parent (the tool resolves/creates the record).
   - All apply all-or-nothing and return compact acks; the acks' `documentIds` / `id`s feed
     step 6 directly — don't refetch.
6. **Emit `FiledArtifact[]`** — one per candidate, `needId`/`candidateId` carried through for
   traceability; `action` reflecting what happened (`created-note`/`posted-to-note` set `matterId`;
   record actions set `recordId`); echo the candidate's `inspection` marker so the recap has it.
7. **Recap (review, not approval).** Immediately after applying, print a short table summarising
   the batch: candidate title → home (account/record — existing vs new — or note) → action →
   one-line reason (`rationale`, plus `confidence` when it was judgement-y) → **Opened?** (`✓ <method>`
   when the item was opened to confirm, `– metadata-only` otherwise — the `inspection` marker). Include
   placeholders created and duplicates skipped. This is the "after" bookend to the step-4 confirm
   table — same shape, outcomes filled in — and is **not** a gate: no confirmation is requested
   (`wp-ref-conventions` — post-filing recap & confirm-by-opening). Close the recap with one review
   link per binder touched — the binder's `webUrl` plus the sub-screen that best shows the batch
   (`/matters/notes` when notes were created or posted to, otherwise the records / trial-balance view) —
   offered proactively so the user can review the filing in Active.

## Failure handling

- A failed document create/upload → fall back one rung on the transfer ladder; if all rungs
  fail, emit a placeholder `FiledArtifact` with `action:"created-record"` for a
  `DocumentPlaceholder` record and say so.
- Never invent document ids; never attach across binders (`active-workpapers-matters-apply` /
  `active-workpapers-workpaper-records-apply` validate every linked id against the binder up front and
  reject the whole batch on a miss).
- Skill, not agent: deterministic, bounded mutations — stays inline for the confirmation gate.
