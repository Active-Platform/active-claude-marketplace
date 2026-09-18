---
name: wp-ref-query-preferences
description: Reference — the queryCorrespondence preferences schema (channel, emailDraft, grouping, itemStyle, showProvenance, signatory), resolution precedence and shipped default behind ~/.claude/active-workpapers/preferences.json. Loaded by wp-client-queries-query-compile, wp-client-queries-compile and wp-setup via the Skill tool; not a standalone task.
kind: skill
user-invocable: false
---

# Query correspondence preferences — schema, semantics, shipped default

Firm/user preferences for how **client-query** correspondence is formatted. These are
**chosen, not probed** (unlike the capability manifest), so they live in a user-level file that
survives a capability refresh:

```
~/.claude/active-workpapers/preferences.json
```

`wp-setup` prompts for these **once** (when the file is absent) and writes them; the user can
re-run `wp-setup --preferences` to change them. A `wp-setup --refresh` re-probes connectors and
rewrites `sources.json` **only** — it never touches this file.

Scope: this doc governs the `queryCorrespondence` block only. The file may later grow other
blocks (e.g. a general firm `correspondence` block); skills read only the block they own.

## Resolution precedence (this skill)

1. Read `~/.claude/active-workpapers/preferences.json` → `queryCorrespondence` if present → use it.
2. Else fall back to the **shipped default below** and tell the user they can run `wp-setup` to
   set the firm's style.

## Schema

```jsonc
{
  "schemaVersion": 1,
  "setBy": "setup@2026-07-08T00:00:00Z",   // tool + ISO timestamp, or "default"
  "queryCorrespondence": {
    "channel": "email",        // email | letter — primary format for query correspondence
    "emailDraft": "auto",      // auto | off — when channel=email & a draft-capable engine is present, drop the request into the mail client as a draft (auto) or always render inline (off)
    "grouping": "type",        // type | entity — how queries are grouped in a multi-entity document
    "itemStyle": "checkbox",   // checkbox | bullet | numbered — how each ask is rendered
    "showProvenance": true,    // mark new vs previously-requested items in the document
    "signatory": "manager"     // manager | partner — who signs off (resolved from BinderContext.team)
  }
}
```

Field semantics:

- **`channel`** — the format a compiled request is produced in by default. `email` → an email
  body; `letter` → a `.docx` via the `docx` skill. The caller can still override per-run.
  (Independent of whether a *send* tool exists — `outlook-email.send` in `sources.json` governs
  that; correspondence is draft-only when no send tool is present.)
- **`emailDraft`** — whether an email-channel request is placed into the mail client as a draft.
  `auto` (default): when `channel` is `email` **and** the manifest reports a draft-capable engine
  (`outlook-email.draft=true`), the skill offers to compose the request as a draft in the mailbox
  for the user to review and send. `off`: always render the email inline in chat instead. No
  effect when `channel` is `letter` or no draft-capable engine is connected (the skill falls back
  to the inline draft regardless). This is the "unless the setup says otherwise" opt-out — set via
  `wp-setup --preferences`. Distinct from actually *sending*: creating a draft never dispatches the
  email, and queries still flip to `Sent` only on the user's explicit send confirmation.
- **`grouping`** — how a **multi-entity** document is organised. `type` groups asks by
  information type so like items sit together (all bank statements, then all invoice requests, …)
  and **tags each ask with the entity it relates to**. `entity` groups by entity first (a
  section per entity), then by type within each. A single-entity job has nothing to mark or
  split, so `grouping` is moot there — asks group by type either way.
- **`itemStyle`** — how each ask renders. `checkbox` (`- [ ] …`) lets the client tick items off;
  `bullet` is a plain dot-point list; `numbered` is an ordered list. All three keep one ask per
  line so the client can answer point by point.
- **`showProvenance`** — when `true`, the document visibly distinguishes **new** asks from items
  **previously requested** (see the skill's step 4). Forced off when a run is `newOnly` (nothing
  previously-sent is included).
- **`signatory`** — which member of `BinderContext.team` signs the correspondence. (Affects the
  sent document's sign-off; the headless content sample deliberately omits the signature block.)

Unknown/extra keys are allowed; skills ignore what they don't understand.

## Shipped default

Used when no `preferences.json` exists. Matches the firm's most common house style: an email,
drafted into the mail client when one's connected, queries grouped by information type, rendered as
tickable checkboxes, new-vs-previous marked.

```json
{
  "schemaVersion": 1,
  "setBy": "default",
  "queryCorrespondence": {
    "channel": "email",
    "emailDraft": "auto",
    "grouping": "type",
    "itemStyle": "checkbox",
    "showProvenance": true,
    "signatory": "manager"
  }
}
```

A headless content sample rendered from this default lives in the *Example query content* section of
`wp-client-queries-query-compile` — it shows the body/content format only, not the channel wrapper
(addressee, salutation, signature).
