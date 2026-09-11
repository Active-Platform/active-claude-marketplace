#!/usr/bin/env bash
#
# Fails if an internal reference reaches the published tree. Runs on this repo's own pull requests,
# and is invoked by the internal repo's publish workflow against the tree it is about to push, so a
# generated payload cannot open a pull request that is already failing here.
#
# Everything under .github/ is exempt from the scan, which is the only reason this file can hold
# the pattern without matching itself.
#
# The list is deliberately narrower than the internal build gate:
#   - product names that ship to users are allowed (the document skills, the byte-transfer helper
#     in tools/) -- they are part of the plugin, not an internal detail;
#   - the internal identifiers that gate blocks are not repeated here. Naming them in this repo
#     would be the very disclosure the gate exists to prevent, and nothing generated can carry one
#     past it.
#
# Usage: check-forbidden-references.sh [directory]   (default: the current directory)

set -euo pipefail

target="${1:-.}"

# Character classes and a no-backslash boundary so the pattern needs no escapes.
pattern='mcp-staging|localhost|127[.]0[.]0[.]1|atlassian[.]net|dev[.]businessfitness|(staging|uat|qa|test)[.]businessfitness|[$][{]ACTIVE_MCP_URL|[.]pdb($|[^a-z])'

if grep -rEn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.github "$pattern" "$target" ; then
  echo "::error::Internal reference found (see matches above). The published tree must not contain these."
  exit 1
fi

echo "No forbidden references in $target."
