# Changelog — Active Platform

Releases of this plugin, newest first.

## 1.0.1-preview.8

First release. The plugin is in preview — expect it to change between releases, and please tell us
what breaks.

- Ask Active for what you need in plain language: find client entities and client groups, see who
  the partner and manager are, open the documents filed against a client, read a workpaper binder
  and its trial balance, and look up your own profile. Everything returned is scoped to your own
  Active access, and nothing is created or changed without Claude confirming it with you first.
- Ask to see a document and you get a link to it in Active — durable, yours to keep and share —
  rather than a download of the file. Ask to download or edit it instead and the link takes you
  straight there. Claude still fetches the file when it needs the contents themselves.
- Document searches cover a client's whole history, as the app's document list does. A client-group
  search can cover only the last 30 days when your firm's search index can't serve it — while the index
  is still being prepared, or for a filter it doesn't hold, such as source; Claude tells you when that
  happens and can search the period you need. You can choose which fields a search matches —
  title, email subject, keywords, client or description — and a quoted document number comes first.
- Work on a document end to end: fetch it to disk, edit it with any tool, and upload it back as a
  new version. Claude moves the bytes itself and asks you to approve each transfer, so you see
  every file that leaves or arrives. The file never passes through the conversation, and there is
  nothing extra to install for this to work.
- Added the workpapers client-queries suite: work out what a binder still needs from the client,
  search what the firm already holds, file what it finds, record the gaps as queries, and draft the
  client correspondence. Run `/active-platform:wp-setup` once first — it detects which sources you
  can search, captures your firm's correspondence style, and checks that the background worker
  these skills rely on can reach Active. If it cannot — which happens when Active was connected
  outside this plugin — setup explains why and offers to write the one-file fix for you.
- Set up a new workpaper binder by asking for one. Claude works out the template, period, source,
  columns and rollover with you, shows you the whole plan once to approve, then creates the binder,
  rolls it over, configures it and imports the trial balance, telling you when the import is done.
  When a step needs you — reconnecting to your accounting system or choosing a Ledger dataset —
  Claude gives you the link and picks up where it stopped once you say it's sorted. AU binders also
  come with a link to connect the ATO.
  Longer steps such as a rollover get up to four minutes before Claude stops waiting.
- What a Workpapers-only licence covers is spelled out in setup and the requirements. You can
  search, open, file, update and link documents; adding a new version of an existing document and
  opening a stored email's body need Active Documents. Where versioning is unavailable the filing
  skills file a new document alongside instead of stopping.
- Only two Active tools load at the start of a session and the rest arrive on demand, so the
  connection can look almost empty when it is perfectly healthy. Claude checks before it concludes
  anything, and if something really is switched off it tells you which licence covers it and who can
  change it, rather than sending you to reconnect.
- Sign-in happens in your browser the first time you use a tool. There is no API key to configure,
  and the plugin holds no credentials of its own. Use a current version of Claude Code — if sign-in
  fails with a registration error, update Claude Code and connect again.
- Licensed under the Apache License, Version 2.0, with the licence text and attribution notices
  included in the package.
