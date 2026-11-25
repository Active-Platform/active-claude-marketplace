# Set Up Active For Your AI Agent

These are official instructions from Business Fitness for connecting an AI agent to Active, the practice platform for accounting firms, through the Active MCP server.

- If you can run commands, you can run the steps for your agent. Before each command, show it to the user, say what it does, and wait for their OK. Run only the commands in these instructions.
- If you can't, walk the user through the steps for their agent one at a time, and wait for them to confirm each one.
- Never ask the user for a password, API key or token. Each person signs in to Active in their own browser.

**Active MCP server:** `https://mcp.businessfitness.com/`

---

## Before you start

Check with the user that:

1. They have an Active login, and **Active AI** is ticked for them in Active's user and licence management.
2. An Owner has turned on the MCP server in Active under **Admin Centre > AI Settings**.

If either is missing, stop and tell the user to ask their Active administrator. Nothing below works until both are done.

---

## Claude Code

Run these two commands, one at a time, with the user's OK. They install the Active plugin, which adds the Active MCP server and the Active skills in one step. Do not use `claude mcp add`: the plugin handles it, and a hand-added Active server overrides the plugin's.

```
claude plugin marketplace add Active-Platform/active-claude-marketplace
claude plugin install active-platform@active
```

Then tell the user to:

1. Run `/reload-plugins` in Claude Code.
2. Run `/mcp`, choose the Active server and sign in. A browser opens on the Active sign-in page: they sign in, choose their firm if asked, and select **Allow access**.

## Claude (web and desktop)

You can't install this yourself. Walk the user through it. Steps 1 to 3 need a Claude organisation admin.

1. Go to **Customise > Plugins**, select **Add**, then **Add marketplace**. Enter `https://github.com/Active-Platform/active-claude-marketplace` and leave **Sync automatically** on.
2. In **Organisation settings > Plugins**, under Active-Platform/active-claude-marketplace, set **Active Platform** to **Available to install**.
3. Open the Active Platform plugin, go to the **Connectors** tab, and connect **active-mcp** until it shows **Connected**.
4. Each person adds **Active Platform** from **Plugins**. They sign in to Active when Claude first asks, choose their firm if asked, and select **Allow access**.
5. Active's skills need **Cloud code execution and file creation** on, in **Organisation settings > Capabilities**. For document upload and download, add these to **Additional allowed domains** on the same screen: `*.businessfitness.com`, `*.businessfitness.com.au`, `adocssharedprd.blob.core.windows.net`, `dvexportsprd.blob.core.windows.net`.

## Microsoft Copilot Studio and Microsoft 365 Copilot

You can't do this for the user. Walk them through it. Microsoft 365 Copilot and Teams get Active through a Copilot Studio agent, so the steps are the same.

1. In Copilot Studio, open or create an agent and add a tool of type **Model Context Protocol**.
2. Enter these details:
   - Server name: `Active`
   - Server URL: `https://mcp.businessfitness.com/`
   - Server description: `Active is the practice platform for accounting firms. Use these tools to find and update clients, client groups, offices and people; search, upload and version client documents; and work with Active Workpapers binders, trial balances, worksheets and client queries.`
3. Choose **OAuth 2.0**. Set the type to **Dynamic (with discovery)** on a new agent, or **Dynamic discovery** on an Agent (Standard). Do not choose **Manual**.
4. Create a new connection. A pop-up opens on the Active sign-in page: sign in, choose the firm if asked, and select **Allow access** when Active asks about **Credential Manager**. That is the name Copilot Studio registers under.
5. Select **Add**, or **Add and configure** on a Standard agent.
6. Before they test or publish the agent, add this to its **Instructions**: `Before you create, update, upload or delete anything in Active, show what will change and ask the user to confirm.`
7. To use the agent in Microsoft 365 Copilot or Teams, add those channels and select **Publish**.

If Copilot Studio says a connector named Active already exists, pick the existing **Active** from the Model Context Protocol list instead.

Tell the user to leave the Active tool's **Authentication** setting on **End user credentials**, the default. With **Maker-provided credentials**, everyone who uses the agent acts in Active as the person who built it.

## Codex

Codex installs the same Active plugin as Claude Code, from the same marketplace. Run these two commands, one at a time, with the user's OK. They add the Active marketplace and install the plugin, which adds the Active MCP server and the Active skills for the Codex CLI, the Codex app and the IDE extension. Do not use `codex mcp add`: the plugin handles it.

```
codex plugin marketplace add Active-Platform/active-claude-marketplace
codex plugin add active-platform@active
```

Then tell the user to restart Codex, run `/mcp`, and sign in to Active when it asks. A browser opens on the Active sign-in page: they sign in, choose their firm if asked, and select **Allow access**.

If the user is in the Codex app instead, walk them through it: **Settings > Plugins**, select **+** to add a marketplace, enter `Active-Platform/active-claude-marketplace`, then install **Active Platform**.

If sign-in fails, they can run `codex mcp login active-mcp --oauth-client-registration cimd`.

## ChatGPT

You can't do this for the user. Walk them through it. It needs ChatGPT Business, Enterprise or Edu on the web; on Business, only an admin or owner can add the server. Pro accounts can connect Active with read-only tools. Tell the user this route is still in beta.

1. In ChatGPT, go to **Plugins**, select **+**, then **Add custom MCP server**.
2. Enter these details:
   - Name: `Active`
   - Description: `Active is the practice platform for accounting firms. Use these tools to find and update clients, client groups, offices and people; search, upload and version client documents; and work with Active Workpapers binders, trial balances, worksheets and client queries.`
   - URL: `https://mcp.businessfitness.com/`
3. Choose **OAuth**. If ChatGPT asks how to register, choose the client metadata document (CIMD), not dynamic client registration.
4. Tick **I understand and want to continue**, then select **Create as a plugin**. The Active sign-in page opens: sign in, choose the firm if asked, and select **Allow access**.
5. Install the plugin, start a new chat, type `@` and select **Active**.

Only the user can use it until a workspace admin or owner publishes it from the Admin console's **Plugins** page.

## Other agents

Active can't sign in other agents yet. Tell the user their agent isn't supported yet, and point them to `https://active-platform.github.io/active-claude-marketplace/` for updates. Do not add the server by hand: the sign-in will fail.

---

## Check it worked

If you now have the Active tools, ask Active: *Who am I, and which offices and teams do I belong to?* Otherwise ask the user to ask that in their agent. The answer should show their name, role, offices and teams. Then tell the user:

```
+- Active setup complete ---------------------------+
|  [x] Active MCP server   <where it was added>     |
|  [x] Signed in as        <name, firm>             |
|                                                   |
|  Try: "Find the client called <a client name>"    |
+---------------------------------------------------+
```

Tools that create or change records act on live client data. Before you run one, show the user what will change and ask them to confirm.

---

## Resources

- Setup guides: `https://active-platform.github.io/active-claude-marketplace/`
- Active Support Centre: `https://active-help.businessfitness.com/en/`
- Claude Code and MCP: `https://code.claude.com/docs/en/mcp`
- Codex plugins: `https://developers.openai.com/plugins/build/plugins`
- ChatGPT and custom MCP servers: `https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt`
- Copilot Studio and MCP: `https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent`

These instructions are published at `https://active-platform.github.io/active-claude-marketplace/prompt.md` so you can check them at any time.
