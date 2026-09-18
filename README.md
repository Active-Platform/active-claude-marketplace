# Active Platform plugin for Claude

Work with your **Active Platform** client book from Claude: find clients and client groups, browse their documents and workpaper binders, and run the Workpapers client-query workflows through natural conversation.

## Requirements

- An Active Platform subscription and user account. Without one, sign-in completes but tools return a "not entitled" error.
- The Claude desktop app.

## Install

```
/plugin marketplace add Active-Platform/active-claude-marketplace
/plugin install active-platform@active
```

Start a conversation and use an Active tool; the first call opens your browser to sign in.

## What you can ask

```
Find the client group for Smith Family Trust and list its entities
```
```
Show me the open workpaper binders for ACME Pty Ltd for FY2026
```

## Data, terms and privacy

The plugin connects Claude to the Active MCP server using your Active Platform sign-in; conversation content, including tool results, is sent to Anthropic under Anthropic's terms. For Business Fitness terms, privacy and contact, see [active.businessfitness.com](https://www.active.businessfitness.com).

Licensed under the [Apache License 2.0](LICENSE); see [NOTICE](NOTICE). Claude is a trademark of Anthropic, PBC; not affiliated with Anthropic or activeplatform.com.
