---
name: active-documents-upload
description: Upload a local or just-edited file into Active as a new document or a new version — or ingest a file straight from an https URL. Use when the user wants to upload, attach, save, or add a document (or a new version) to a client in Active.
---

# Upload a file into Active (new document or new version)

Get a file into Active as a **new document** or a **new version** of an existing one. Pick the transport by
where the bytes are; either way the bytes never pass through the conversation.

## Choose the transport

- **The file is already at an https URL** (e.g. a SharePoint / OneDrive download link) → don't touch the
  disk, and prefer this whenever it is available. Pass that URL as **`sourceUrl`** to
  `active-documents-documents-create` (new document) or `active-documents-document-versions-create`
  (new version); the server fetches it directly, so you move no bytes at all.
- **The file is local or was just edited** → use the `uploadToken` path below.

## Local / edited file → uploadToken

1. **Confirm first.** Uploading and adding a version are writes — restate what will happen (which client /
   document, new document vs new version) and proceed only on the user's go-ahead.
2. Mint a write URL **just before uploading** (its ≈30-minute TTL should cover the upload, not your edit
   time): call **`active-documents-uploads-start`**. It returns a write **SAS URL** and an **`uploadToken`**.
3. **`PUT` the file's bytes to that URL** with header `x-ms-blob-type: BlockBlob`, using whatever HTTP
   client you can run in this environment. A **`201 Created`** means the bytes landed. The URL carries its
   own credentials — add no auth headers of your own.

   - Send the file from disk; never inline its contents into the command or the conversation.
   - This normally costs **one permission prompt**, because it is a shell/network call. That is expected
     and routine — approve-and-continue is the whole flow, not a sign something is wrong and not a reason
     to stop and report that you cannot upload. Say what you are uploading and where it is going.
   - If the `PUT` fails for any reason, **do not retry the same URL**: call
     `active-documents-uploads-start` again for a fresh url + `uploadToken` and repeat this step. A spent
     or expired session will be rejected at commit.

4. Commit, passing the `uploadToken` (never the bytes):
   - **New document:** `active-documents-documents-create` with `uploadToken`, plus `title`,
     `fileExtension`, `clientId`, etc.
   - **New version of an existing document:** `active-documents-document-versions-create` with `uploadToken`
     and the document id. This becomes the active version.
5. Report the result from the detail the commit tool returns.

## Notes

- The server re-validates the file at commit (extension allow-list, content signature, 100 MB cap), so a
  bad file is rejected then rather than at the `PUT`.
- A write URL is a short-lived capability for one file: treat it as a credential, don't log it or paste it
  anywhere durable, and mint it fresh rather than reusing one.
- The full round-trip is: `active-documents-fetch` (download) → edit with any tool → this skill (upload as
  a new version).
