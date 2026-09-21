# Active Platform plugin for Claude

> **Generated artifact.** This directory is produced from Business Fitness's internal source and republished on each release. It is not edited here, and this repository does not accept external contributions.

Work with your **Active Platform** client book from Claude: find clients and client groups, browse their documents and workpaper binders, move documents between Active and your disk, and run the Workpapers client-query workflows through natural conversation.

## What's in it

| Part | Purpose |
|------|---------|
| `.mcp.json` | Connects Claude to the Active MCP server (`active-mcp`) using OAuth 2.1 with PKCE. You sign in with your Active Platform account. |
| `skills/active-assistant` | The Active assistant persona: how to search clients, groups, entities, documents and binders, and how to present results. |
| `skills/active-documents-fetch`, `skills/active-documents-upload` | Fetch an Active document to disk, edit it with any tool, and upload it back as a new version. Claude moves the bytes itself and asks you to approve each transfer. The bytes travel directly between Azure storage and your disk — they never pass through the conversation. |
| `skills/wp-intake-*`, `skills/wp-client-queries-*`, `skills/wp-find-and-file`, `skills/wp-binder-resolve`, `skills/wp-setup` | The Workpapers client-queries suite: intake, discovery, information needs, query compilation, filing and follow-up. |
| `skills/wp-ref-*` | Reference material the Workpapers skills draw on: conventions, tool contracts, recipes, sources, review rules and query preferences. |
| `agents/wp-discover` | A read-only discovery sub-agent used by the Workpapers skills for a single binder. It never writes. |

## What runs automatically

Nothing. The plugin is content only — skills, a sub-agent and the server connection. It registers no
hooks, bundles no executable, and starts no background process.

Moving a document is the one thing that reaches outside the conversation, and Claude asks you to
approve it each time: once to fetch a file to your disk, once to upload one back. You see every file
that leaves or arrives, and nothing is approved on your behalf.

## Requirements

An Active Platform subscription and user account. Without one, sign-in completes but tools return a "not entitled" error.

There is nothing else to install.

## Privacy

Requests to Active tools travel over HTTPS to the Active MCP server with your sign-in; results come from your firm's tenant, subject to your permissions. Claude sends conversation content, including tool results, to Anthropic under Anthropic's terms. The plugin stores no data, sends no telemetry, and runs no code of its own on your machine. For terms, privacy and contact, see [active.businessfitness.com](https://www.active.businessfitness.com).

## Licence

Apache License 2.0. Copyright 2026 Business Fitness (Accountants) Pty Ltd. See the repository's LICENSE and NOTICE files.
