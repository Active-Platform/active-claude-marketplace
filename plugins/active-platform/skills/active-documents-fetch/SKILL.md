---
name: active-documents-fetch
description: 'Download an Active document''s active version to a local file so you (or another tool) can open or edit it. Use when the user wants to fetch, download, open, or pull an existing Active document to disk — typically the first half of "edit this document and save it back". Not for showing someone a document or sending them a link: every document result already carries a `webUrl` into Active for that.'
---

# Fetch an Active document to a local file

Bring an Active document's **active version** down to local disk so it can be opened or edited. The bytes
move directly between Azure storage and disk — they never pass through the conversation.

## When to use this

- The user wants to **open, read, or edit** an existing Active document locally (Word, Excel, PDF, …).
- As the first step of the round-trip **download → edit (any tool) → upload back as a new version** (the
  upload half is the `active-documents-upload` skill). Editing itself is out of scope here — hand the
  downloaded file to whatever edits it (e.g. the docx/xlsx skills, or the user).

## When not to use this

The user wants to **see** the document, or wants a link to it — "give me a preview link", "send me that
file", "where is it in Active". Downloading is the wrong answer: every document result carries a
`webUrl`, a durable link to the document in Active. Give them that link and stop. It opens in preview;
append `?action=download`, `?action=editOnline` or `?action=editDesktop` if they asked for that instead.
This skill is for when *you* need the bytes.

## Steps

1. Identify the document. If you only have a name — or the user-facing Document ID ("document #1234") —
   use `active-documents-documents-search`: a digits-only search term exact-matches `documentNumber`
   (the Document ID) alongside the usual title/code/description matching. Confirm the right record and
   note its **`id`** — the GUID every tool below takes as `documentId`, not the Document ID.
2. Mint a download link: call **`active-documents-documents-link`** with `linkType: "download"`. It returns
   a short-lived Azure Blob **SAS URL** for the active version (≈15-minute TTL — fetch promptly).
3. **`GET` that URL straight to a file on disk**, using whatever HTTP client you can run in this
   environment. The URL already carries its own credentials, so the request needs no auth headers of
   yours.

   - Write it to the document's filename in the current working directory unless the user asked for
     somewhere specific. Pick the destination before you start — stream the response to the file rather
     than reading the bytes into the conversation.
   - Don't overwrite an existing file without saying so; pick a distinct name or confirm first.
   - This normally costs **one permission prompt**, because it is a shell/network call. That is expected
     and routine — approve-and-continue is the whole flow, not a sign something is wrong and not a reason
     to stop and report that you cannot fetch the document. Just say what you are fetching and why.
   - Note the path you wrote — that is the file to open or edit.

4. Hand the local path to whatever will open or edit it. To save changes back, use the
   `active-documents-upload` skill.

## Notes

- A download URL is a short-lived capability: treat it as a credential, don't log it or paste it into
  anything durable, and re-mint it rather than reusing a stale one. If it has expired (the GET fails),
  call `active-documents-documents-link` again for a fresh one.
- Both link types from `active-documents-documents-link` are short-lived storage credentials, not a place
  in Active: a `preview` link (its default) opens a browser viewer over the bytes and is **not** the raw
  file, so always pass `linkType: "download"` when you intend to edit them. Neither is the link to hand a
  person — that is the document's `webUrl`.
