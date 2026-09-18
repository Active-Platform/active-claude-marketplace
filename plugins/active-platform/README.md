# Active Platform plugin for Claude

> **Generated artifact.** This directory is produced from Business Fitness's internal source and republished on each release. It is not edited here, and this repository does not accept external contributions.

Work with your **Active Platform** client book from Claude: find clients and client groups, browse their documents and workpaper binders, move documents between Active and your disk, and run the Workpapers client-query workflows through natural conversation.

## What's in it

| Part | Purpose |
|------|---------|
| `.mcp.json` | Connects Claude to the Active MCP server (`active-mcp`) using OAuth 2.1 with PKCE. You sign in with your Active Platform account. |
| `skills/active-assistant` | The Active assistant persona: how to search clients, groups, entities, documents and binders, and how to present results. |
| `skills/active-documents-fetch`, `skills/active-documents-upload` | Fetch an Active document to disk, edit it with any tool, and upload it back as a new version. The bytes move directly between Azure storage and your disk — they never pass through the conversation. |
| `skills/wp-intake-*`, `skills/wp-client-queries-*`, `skills/wp-find-and-file`, `skills/wp-binder-resolve`, `skills/wp-setup` | The Workpapers client-queries suite: intake, discovery, information needs, query compilation, filing and follow-up. |
| `skills/wp-ref-*` | Reference material the Workpapers skills draw on: conventions, tool contracts, recipes, sources, review rules and query preferences. |
| `agents/wp-discover` | A read-only discovery sub-agent used by the Workpapers skills for a single binder. It never writes. |
| `tools/bf-doc.dll`, with the `bf-doc` and `bf-doc.cmd` shims | The document mover: a small .NET console app that copies bytes between your disk and a short-lived, signed Azure Storage URL — the form Active issues for a document. It refuses any other kind of address, holds no credentials of its own, and sends no telemetry. |
| `hooks/hooks.json` | Two Claude Code hooks — see **What runs automatically**. |

## What runs automatically

Enabling this plugin registers two Claude Code hooks. Both run the bundled `bf-doc` helper.

- **SessionStart** — `bf-doc __session-init`, once per session. It puts this plugin's `tools/` directory on the session `PATH`, so the document skills can call `bf-doc` by name.
- **PreToolUse, matcher `Bash`** — `bf-doc __approve-hook` is consulted **before every Bash command Claude runs in the session**, including commands that have nothing to do with Active. It reads the command line and auto-approves it only when it is a `bf-doc` document transfer against a signed Azure Storage URL of the form Active issues for a document. For anything else it returns no decision and Claude's normal permission prompt applies. It never denies a command, never rewrites one, and sees nothing beyond the command line Claude was about to run.

If you would rather approve each document transfer yourself, delete `hooks/hooks.json` from your copy of the plugin. The document skills still work; they just prompt each time.

## Requirements

An Active Platform subscription and user account. Without one, sign-in completes but tools return a "not entitled" error.

The two document skills also need the **.NET 10 runtime** on your machine, which `bf-doc` is built against. Earlier .NET versions will not run it. Everything else in the plugin — the client, group, document and binder tools, and the whole Workpapers suite — works without it, and the two hooks above quietly do nothing rather than report an error on every command.

## Privacy

Requests to Active tools travel over HTTPS to the Active MCP server with your sign-in; results come from your firm's tenant, subject to your permissions. Claude sends conversation content, including tool results, to Anthropic under Anthropic's terms. The plugin stores no data and sends no telemetry; as described above, its `PreToolUse` hook observes the Bash command lines Claude is about to run, and nothing else. For terms, privacy and contact, see [active.businessfitness.com](https://www.active.businessfitness.com).

## Licence

Apache License 2.0. Copyright 2026 Business Fitness (Accountants) Pty Ltd. See the repository's LICENSE and NOTICE files.
