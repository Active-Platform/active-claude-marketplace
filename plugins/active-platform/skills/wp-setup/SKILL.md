---
name: wp-setup
description: Shared foundation — generate or refresh the per-user Workpapers capability manifest (sources.json) by probing connected servers, M365, and licences, and seed the firm's editable config — correspondence preferences (preferences.json) and the trial-balance review policy (review-rules.md). Run on first use, with --refresh when connectors change, --preferences to re-set the correspondence style, or --rules to reinstall the default review policy.
kind: skill
---

# wp-setup — capability manifest + correspondence preferences

Produce three per-user files under `~/.claude/active-workpapers/`:

1. **`sources.json`** — the capability manifest every `wp-*` skill consults to decide which
   sources it may search and which actions are available. **Generated, never hand-authored** — a
   cache of a detection run; the truth is the live environment. Schema, field semantics, and the
   shipped conservative default: `wp-ref-sources`.
2. **`preferences.json`** — the firm's **query correspondence preferences** (how query
   letters/emails are formatted), in a `queryCorrespondence` block. **Chosen, not probed** —
   captured by a one-time prompt. Schema, field semantics, and shipped default:
   `wp-ref-query-preferences`.
3. **`review-rules.md`** — the firm's **trial-balance review policy** (what evidence to ask the
   client for, and what not to), consumed by `wp-client-queries-info-needs`. **Chosen/edited, not
   probed** — a plain-English Markdown policy the firm tweaks. Seeded from the shipped default:
   `wp-ref-review-rules`.

The three shipped defaults named above are **reference skills** — load each with the Skill tool
(`wp-ref-sources`, `wp-ref-query-preferences`, `wp-ref-review-rules`); never read them off disk.

The three are deliberately separate: `--refresh` re-probes connectors and overwrites **only**
`sources.json`; it never disturbs the firm's chosen preferences or review policy. `--preferences`
re-runs **only** the correspondence prompt; `--rules` reinstalls **only** the default review
policy.

**Inputs:** none (optional `--refresh`, `--preferences`, `--rules`). **Output:** the written
file(s) + a short human summary. **Side-effects:** writes user-level files outside the repo — the
probe is non-destructive runtime state (no confirmation); the preference prompt is interactive by
nature; the review policy is copied from the shipped default (no prompt). One further file is
possible — a `~/.claude/agents/wp-discover.md` override when step 3 finds the discovery worker
cannot reach Active — and it is written **only** on an explicit yes, because it shadows a shipped
agent and does not track plugin updates.

## Procedure

1. **Licences (authoritative for Active products + AI tier).**
   `active-core-me-get` → `user` block; `active-core-me-capabilities-list` → `capabilities`
   block. If these fail, record `active-core` as `error` and continue — the probe results
   still stand on their own.
2. **Connectivity/scope probe — one cheap read per surface on the `active-mcp` server:**
   - `active-workpapers-binders-search` (pageSize 1) → `active-workpapers` (`connected`; read + the
     `*-apply` / `*-attach` write tools exist, gated by licence).
   - `active-documents-documents-search` (pageSize 1) → `active-documents` (`connected`; documents
     read+write — create/upload tools exist). `active-core` connectivity is already confirmed by the
     `active-core-me-get` call in step 1 (core write only if the licence says so).
     **The document surface splits by licence, so `connected` is not all-or-nothing.** Search, get,
     create, update, link and upload reach a firm licensed for *either* Documents or Workpapers;
     document **versioning** and email-body reads (`active-documents-document-versions-*`,
     `active-documents-documents-email-get`) need Active **Documents** specifically. Check
     `active-documents-document-versions-list` against the step-1 capabilities to tell the two apart,
     and record the narrower case as connected-but-partial rather than `absent`.
   - M365 `get_me` → `outlook-email`, `sharepoint`, `teams` read access. **`draft` and `send` each
     stay `false` unless a matching tool is actually exposed** — search the available tool surface
     for an email compose/create-draft tool (sets `draft`) and separately for a send tool (sets
     `send`); do not infer either from read access. `draft` is the softer capability (compose a
     draft in the mailbox, don't dispatch) and can be `true` while `send` is `false`. (Neither
     exists in this environment, so both stay `false`.)
   - FYI: no connector exists today → `absent`. (Future: a ping tool.)
   A probe that throws → `status: "error"`; a missing tool surface → `status: "absent"`.
3. **Sub-agent reachability — decides whether the filing recipes work at all.**
   `wp-find-and-file` and the `wp-client-queries-*` recipes do their reading inside the
   `wp-discover` sub-agent, whose allowlist names each Active tool under the bundled server's own
   registration (`mcp__plugin_active-platform_active-mcp__<tool>`). **A grant fires only on the
   exact registered name**, so if Active reached this session any other way the worker gets *no*
   Active tools and every recipe that spawns it fails — while the main conversation stays healthy,
   which makes the failure look like a broken connection when it is not.
   Read the prefix off the Active tools already in front of you (the ones called in steps 1-2);
   never guess it, and never spawn the worker to find out:
   - Prefix is `mcp__plugin_active-platform_active-mcp__` → record `subagent.status` `reachable`.
     Nothing to do.
   - Any other prefix — a connector registers as `mcp__<id>__<tool>` with an `<id>` that varies per
     install and so cannot be named in a shipped file — → record `subagent.status` `unreachable`
     and `subagent.prefix` as the literal prefix you observed, then **offer the override** below.
   The override, written only if the user accepts: copy the plugin's own
   `${CLAUDE_PLUGIN_ROOT}/agents/wp-discover.md` to `~/.claude/agents/wp-discover.md` unchanged
   except its `tools:` line, and there replace every `mcp__plugin_active-platform_active-mcp__`
   with the prefix you observed. A user-level agent outranks the plugin's copy of the same name, so
   yours is what runs. Rewriting the prefix in place keeps the worker's 21 read-only grants exactly
   as shipped — do not substitute a whole-server wildcard, which would hand it that server's writes
   too. Say plainly that the copy is frozen: a plugin update will not reach it, so it has to be
   rewritten after one.
4. **Write the manifest.** Merge (1) + (2) + (3) into the schema in `wp-ref-sources`, set
   `generatedBy: "setup@<ISO timestamp>"`, and write to
   `~/.claude/active-workpapers/sources.json` (create the directory if needed).
5. **Query correspondence preferences (one-time prompt).** Only when `preferences.json` is
   **absent** (first run) or the user passed `--preferences`. Ask a short set of questions —
   offer the shipped default
   (`wp-ref-query-preferences`)
   as the pre-selected answer to each so a firm can accept the house style in one keystroke:
   - **Channel** — is query correspondence sent by **email** or as a **letter** (`.docx`)?
   - **Grouping** (how a **multi-entity** job is organised) — group asks by **information type**
     (all bank statements together, …, each ask tagged with its entity) or by **entity** (a
     section per entity)? Single-entity jobs look the same either way.
   - **Item style** — render each ask as a tickable **checkbox**, a plain **bullet**, or a
     **numbered** list?
   - **Email draft** (mention only when `channel` is **email**) — when a mail client that can
     compose drafts is connected, should the request be dropped into it as a **draft** for review
     (`auto`, the default) or always shown **inline** in chat (`off`)? Most firms take `auto`.
   - (Provenance marking of new-vs-previously-requested and the manager/partner signatory can be
     mentioned but default silently — most firms take the defaults.)
   Write the answers to the `queryCorrespondence` block of
   `~/.claude/active-workpapers/preferences.json` with `setBy: "setup@<ISO timestamp>"`, leaving
   any other blocks in the file intact. On `--refresh` (no `--preferences`) skip this step
   entirely and leave the existing file untouched.
6. **Trial-balance review policy (seed once).** Only when `review-rules.md` is **absent** (first
   run) or the user passed `--rules`: load the shipped default (`wp-ref-review-rules`, via the Skill
   tool) and copy **its body** — everything below the YAML frontmatter — verbatim to
   `~/.claude/active-workpapers/review-rules.md`, and tell the user it's theirs to edit
   in place. No prompt — it's prose policy, not a set of choices. Never overwrite an existing file
   unless `--rules` was passed; `--refresh`/`--preferences` leave it untouched.
7. **Report.** One line per source (name, status, capability flags — plus anything degraded, e.g.
   "outlook-email: connected, read-only, no draft/send tool — query-compile will render the email
   inline, draft-only"; or "outlook-email: connected, can compose drafts — query-compile will
   offer to draft into the mailbox"; or, for a Workpapers-only firm, "active-documents: connected,
   search/read/file yes, no versioning — find-and-file will file a new document rather than a new
   version"), then a one-line summary of the correspondence style in effect
   (chosen this run, already set, or shipped default — including the `emailDraft` setting when the
   channel is email), and whether the review policy is the firm's edited copy or the shipped
   default.
   When step 3 found the worker **unreachable**, lead with it — it outranks every source line,
   because the filing recipes cannot run at all until it is resolved: say that Active itself is fine
   and it is the discovery worker that has no tools, name the override as written (or as declined),
   and say that a declined override leaves `wp-find-and-file` and the `wp-client-queries-*` recipes
   unavailable while the plain Active questions keep working.

## Notes

- Never write inside the plugin/skill package; both instances live at the user level and
  survive plugin updates.
- `preferences.json` and `review-rules.md` are *chosen/edited* state, `sources.json` is *probed*
  state — never fold one into the other, and never let a connector refresh clobber the firm's
  correspondence choices or review policy.
- Conservative on doubt: an ambiguous probe result records the *lesser* capability.
- Skill, not agent: a handful of cheap calls plus a short prompt, small output.
