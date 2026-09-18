---
name: wp-ref-sources
description: Reference — the wp-* capability manifest (sources.json) schema, field semantics, resolution precedence and shipped conservative default. Loaded by wp-* skills via the Skill tool; not a standalone task.
kind: skill
user-invocable: false
---

# Capability manifest (`sources.json`) — schema, semantics, shipped default

This reference is **not the manifest itself**. It defines the manifest *schema* and field semantics,
how skills consume it, and ships a **conservative default** used only when no generated manifest
exists. The manifest **instance** skills actually parse is a generated, user-level file written
by `wp-setup`:

```
~/.claude/active-workpapers/sources.json
```

It is **per-user, per-machine runtime state — generated, never hand-authored** — a cache of a
detection run; the truth is the live environment. Refresh with `wp-setup --refresh`. It is not
committed and not edited by hand (mirrors this repo's committed-`seed/` → gitignored `.runtime/`
pattern).

## Resolution precedence (every consuming skill)

1. Read `~/.claude/active-workpapers/sources.json` if present → use it.
2. Else fall back to the **shipped default below** and tell the user to run `wp-setup`.
3. Never read a hand-edited in-package file.

## Schema

```jsonc
{
  "schemaVersion": 1,
  "generatedBy": "setup@2026-07-07T03:12:00Z",   // tool + ISO timestamp of the detection run
  "user": { "userId": "…", "name": "…" },          // from active-core-me-get
  "capabilities": {                                 // from active-core-me-capabilities-list
    "licences": ["…"], "aiTier": "…"
  },
  "subagent": {                                     // can wp-discover reach Active at all?
    "status": "reachable | unreachable | unknown",
    "prefix": "mcp__<id>__"                         // only when unreachable: what was observed
  },
  "sources": {
    "active-workpapers": { "status": "connected | absent | error", "read": true, "write": true },
    "active-documents":  { "status": "connected", "read": true, "write": true },
    "active-core":       { "status": "connected", "read": true, "write": false },
    "outlook-email":     { "status": "connected", "read": true, "draft": false, "send": false },
    "sharepoint":        { "status": "connected", "read": true },
    "teams":             { "status": "connected", "read": true },
    "fyi":               { "status": "absent" }
  }
}
```

Field semantics:

- **`status`** — `connected` = a probe call succeeded this run; `absent` = no tool surface found;
  `error` = tools exist but the probe failed (treat as unusable, surface the error).
- **`read` / `write` / `draft` / `send`** — capability flags per source. `draft` and `send` exist
  only on `outlook-email`, each `true` **only if a matching tool is actually exposed** — never
  inferred from `read`. `draft` = an email can be composed as a draft in the mail client (for the
  user to review and send themselves); `send` = an email can be dispatched outright. They are
  independent: an engine may support `draft` without `send`. (Today no draft or send tool is
  exposed, so both are `false` and `wp-client-queries-query-compile` renders the email inline in
  chat, draft-only, confirm-to-send.)
- **`subagent`** — whether the `wp-discover` worker actually receives Active tools, which is a
  separate question from whether *this* session can reach Active. The worker's allowlist grants on
  the bundled server's exact registered names, so a connector-registered Active leaves the main
  conversation fully working and the worker with nothing. `unreachable` records the prefix that was
  observed and means the recipes that spawn the worker cannot run until the user installs the
  override `wp-setup` offers; `unknown` is a manifest written before this field existed — treat it
  as "not yet established", never as `reachable`.
- Unknown/extra sources are allowed; skills ignore entries they don't understand.

## How skills consume it

- `wp-intake-discover` searches **only** sources with `status=connected` and `read=true`, degrading
  gracefully (note skipped sources in the output) when a system is absent.
- `wp-intake-file` requires `active-documents.write=true` to create documents; otherwise it
  files placeholder records only (source ref in `notes`; see the transfer convention in
  `wp-ref-conventions`).
- `wp-client-queries-query-compile` checks `outlook-email.draft` together with the firm's
  `queryCorrespondence.emailDraft` preference — when the channel is email, a draft-capable engine
  is present, and the preference isn't `off`, it offers to drop the correspondence into the mail
  client as a draft; otherwise it renders the email inline. It also checks `outlook-email.send` —
  `false` means draft-only, statuses flip only on the user's explicit send confirmation.
- `wp-intake-discover` on the `queries` / `thread` anchors needs `outlook-email.read` (or an
  `active-documents` thread) to find replies.
- The recipes that spawn `wp-discover` — `wp-find-and-file`, `wp-client-queries-initial-request`,
  `wp-client-queries-file-and-followup` — check `subagent.status` first. On `unreachable`, say so
  and point at `wp-setup` rather than spawning a worker that will come back empty; a worker that
  returns no Active tools means the same thing, whatever the manifest says.

## Shipped conservative default

Used when no generated manifest exists. Deliberately pessimistic about *capability*: M365 unknown,
nothing sendable — so no skill silently over-reaches. It is **not** evidence about *reachability*:
the three Active entries are an unprobed assumption that the bundled server is connected, held only
so the suite is usable before `wp-setup` runs. A call that finds the tools absent overrides the
manifest — treat the manifest as the weaker source and say what you observed.

```json
{
  "schemaVersion": 1,
  "generatedBy": "default",
  "user": null,
  "capabilities": null,
  "subagent": { "status": "unknown" },
  "sources": {
    "active-workpapers": { "status": "connected", "read": true, "write": false },
    "active-documents":  { "status": "connected", "read": true, "write": false },
    "active-core":       { "status": "connected", "read": true, "write": false },
    "outlook-email":     { "status": "absent", "read": false, "draft": false, "send": false },
    "sharepoint":        { "status": "absent", "read": false },
    "teams":             { "status": "absent", "read": false },
    "fyi":               { "status": "absent" }
  }
}
```

When operating on the default, prepend to your first user-visible output: *"No capability
manifest found — using conservative defaults. Run `wp-setup` to probe your connected systems."*

If the Active tools then turn out not to be callable, do not report the manifest's `connected` as
fact. Search by family prefix first, then call `active-core-me-capabilities-list` and report what it
returns — see the preflight in `wp-binder-resolve`. An unprobed default is never grounds for telling
the user their connection is broken.
