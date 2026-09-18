---
name: wp-find-and-file
description: Use when the user wants to file away what the firm already holds for a client — "file the documents we have for Behemoth", "sweep the inbox/SharePoint and put things on the binder", "tidy up unfiled client docs". Holdings-driven; no client interaction.
kind: recipe
---

# wp-find-and-file — File what we already hold

**Sequence:** `wp-binder-resolve` → `wp-intake-discover` (anchor `held`) → `wp-intake-file`
*(→ `wp-client-queries-query-advance` for query-linked items)*.
Reference skills to load with the Skill tool — index: `wp-ref-recipes`; conventions:
`wp-ref-conventions`.

Holdings-driven: sweep everything the firm holds for the client, classify each item to a binder
location, and file it. A location is a **record** (account/section) or an **internal note** —
context/correspondence with no account home lands as a file-note (existing or new). Candidates the sweep
tags with `relatedQueryId` flow through the query epilogue after filing, so intake also advances open
queries it happens to answer. Shared `intake` recipe — no client interaction, nothing outward-facing.

## Orchestration (run inline; subagent for the sweep)

1. **Resolve** — `wp-binder-resolve` → `BinderContext`. Load the sources manifest
   (`wp-ref-sources`).
2. **Discover (subagent, or inline if none)** — `wp-intake-discover` on the **`held`** anchor, dispatched to the
   `wp-discover` agent (`subagent_type: wp-discover`) per its "run as a subagent"
   section: it writes the full `FilingCandidate[]` to a scratchpad file and returns
   `{ counts, one-liners, filePath }`. Relay the summary to the user. When the manifest's
   `subagent.status` is `unreachable` — or the worker comes back with no Active tools — run the
   sweep inline instead and say why; never skip it.
3. **File (inline)** — read the candidate file, run `wp-intake-file` with the full batch. Its single
   confirmation gate covers all doc/record writes. Ambiguous candidates (empty `proposedTarget`) are
   presented for human routing, not guessed.
4. **Query epilogue (inline)** — candidates carrying `relatedQueryId` go to
   `wp-client-queries-query-advance` (filing already done; it posts the answer message and advances query
   status). Fold these writes into the same confirmation pass where practical.
5. **Report** — the filer already recapped what it filed and why
   (`wp-ref-conventions` — post-filing recap); add only the
   recipe-specific bits: **queries advanced** and **items left for human routing**.

## Notes

- Running this before `wp-client-queries-initial-request` is **optional** — that recipe's single
  `wp-intake-discover` (`needs`) sweep already files held docs it finds along the way. Use
  `wp-find-and-file` first when you want "file what we hold" as its own reviewed step.
- Scope filters (classification / date window) pass straight through to the discover sweep.
