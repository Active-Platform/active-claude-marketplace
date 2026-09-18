---
name: active-documents-upload
description: Upload a local or just-edited file into Active as a new document or a new version, without curl — or ingest a file straight from an https URL. Use when the user wants to upload, attach, save, or add a document (or a new version) to a client in Active.
---

# Upload a file into Active (new document or new version)

Get a file into Active as a **new document** or a **new version** of an existing one. Pick the transport by
where the bytes are; either way the bytes never pass through the conversation.

## Choose the transport

- **The file is already at an https URL** (e.g. a SharePoint / OneDrive download link) → don't touch the
  disk. Pass that URL as **`sourceUrl`** to `active-documents-documents-create` (new document) or
  `active-documents-document-versions-create` (new version); the server fetches it directly. No `bf-doc`.
- **The file is local or was just edited** → use the `uploadToken` path with `bf-doc` (below).

## Local / edited file → uploadToken

1. **Confirm first.** Uploading and adding a version are writes — restate what will happen (which client /
   document, new document vs new version) and proceed only on the user's go-ahead.
2. Mint a write URL **just before uploading** (its ≈30-minute TTL should cover the upload, not your edit
   time): call **`active-documents-uploads-start`**. It returns a write **SAS URL** and an **`uploadToken`**.
3. Move the bytes up with the bundled `bf-doc` helper — call it **bare** (note the order is `<file>` then `<url>`):

   ```
   bf-doc upload "<local-file>" "<write-sas-url>"
   ```

   `bf-doc` ships **inside this plugin** and the plugin makes the bare command above resolve
   automatically — it is **not** an npm/global package. If it ever reports "command not found", the
   `active-platform` plugin is not enabled/loaded in this session; enable it. Do **not** hunt for the binary
   with `npm`, `where`, `which`, `find`, or a file search.

4. Commit, passing the `uploadToken` (never the bytes):
   - **New document:** `active-documents-documents-create` with `uploadToken`, plus `title`,
     `fileExtension`, `clientId`, etc.
   - **New version of an existing document:** `active-documents-document-versions-create` with `uploadToken`
     and the document id. This becomes the active version.
5. Report the result from the detail the commit tool returns.

## Notes

- The server re-validates the file at commit (extension allow-list, content signature, 100 MB cap), so a
  bad file is rejected then — `bf-doc` itself only moves bytes to an Azure Blob SAS URL and refuses any
  other host.
- **Prefer `bf-doc` over any shell transfer.** It needs no permission prompt, is locked to Azure Blob SAS
  hosts, and keeps bytes off the conversation. The tool descriptions point you at your harness's file
  helper — in this plugin that helper is `bf-doc`, so reach for it first rather than `curl`.
- Only if `bf-doc` is genuinely unavailable (the plugin isn't loaded, or the .NET runtime is missing) fall
  back to a direct `PUT` of the file to the write URL with header `x-ms-blob-type: BlockBlob` — a
  `201 Created` means the bytes landed. Expect a permission prompt for that, and say why you needed it.
- The full round-trip is: `active-documents-fetch` (download) → edit with any tool → this skill (upload as
  a new version).
