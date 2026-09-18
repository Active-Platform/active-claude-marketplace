---
name: active-documents-fetch
description: Download an Active document's active version to a local file so you (or another tool) can open or edit it, without curl. Use when the user wants to fetch, download, open, or pull an existing Active document to disk — typically the first half of "edit this document and save it back".
---

# Fetch an Active document to a local file

Bring an Active document's **active version** down to local disk so it can be opened or edited. The bytes
move directly between Azure storage and disk via the bundled `bf-doc` helper — they never pass through the
conversation, and no `curl` is involved.

## When to use this

- The user wants to **open, read, or edit** an existing Active document locally (Word, Excel, PDF, …).
- As the first step of the round-trip **download → edit (any tool) → upload back as a new version** (the
  upload half is the `active-documents-upload` skill). Editing itself is out of scope here — hand the
  downloaded file to whatever edits it (e.g. the docx/xlsx skills, or the user).

## Steps

1. Identify the document. If you only have a name — or the user-facing Document ID ("document #1234") —
   use `active-documents-documents-search`: a digits-only search term exact-matches `documentNumber`
   (the Document ID) alongside the usual title/code/description matching. Confirm the right record and
   note its **`id`** — the GUID every tool below takes as `documentId`, not the Document ID.
2. Mint a download link: call **`active-documents-documents-link`** with `linkType: "download"`. It returns
   a short-lived Azure Blob **SAS URL** for the active version (≈15-minute TTL — fetch promptly).
3. Move the bytes to disk with the bundled `bf-doc` helper — call it **bare**:

   ```
   bf-doc download "<sas-url>" "<dest-path>"
   ```

   - `bf-doc` ships **inside this plugin** and the plugin makes the bare command above resolve
     automatically — it is **not** an npm/global package. If it ever reports "command not found", the
     `active-platform` plugin is not enabled/loaded in this session; enable it. Do **not** hunt for the binary
     with `npm`, `where`, `which`, `find`, or a file search.
   - `<dest-path>` defaults to the document's filename in the current working directory; pass an explicit
     path to put it elsewhere.
   - `bf-doc` refuses to overwrite an existing file unless you add `--overwrite`.
   - `bf-doc` prints the absolute path it wrote — use that as the file to open/edit.

4. Hand the local path to whatever will open or edit it. To save changes back, use the
   `active-documents-upload` skill.

## Notes

- `bf-doc` only ever talks to Azure Blob SAS URLs — it refuses any other host, so there is no permission
  prompt to approve and no risk of it fetching something else.
- Only if `bf-doc` is genuinely unavailable (the plugin isn't loaded, or the .NET runtime is missing) fall
  back to a direct `GET` of the SAS URL to disk. Expect a permission prompt for that, and say why you
  needed it.
- A `preview` link (the default of `active-documents-documents-link`) is a browser-viewer URL, **not** the
  raw file — always pass `linkType: "download"` when you intend to edit the bytes.
