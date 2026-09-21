# Changelog — Active Platform

Releases of this plugin, newest first.

## 1.0.1-preview.5

First release. The plugin is in preview — expect it to change between releases, and please tell us
what breaks.

- Ask Active for what you need in plain language: find client entities and client groups, see who
  the partner and manager are, open the documents filed against a client, read a workpaper binder
  and its trial balance, and look up your own profile. Everything returned is scoped to your own
  Active access, and nothing is created or changed without Claude confirming it with you first.
- Ask to see a document and you get a link to it in Active — durable, yours to keep and share —
  rather than a download of the file. Ask to download or edit it instead and the link takes you
  straight there. Claude still fetches the file when it needs the contents themselves.
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
