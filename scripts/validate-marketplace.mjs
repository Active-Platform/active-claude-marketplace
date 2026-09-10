#!/usr/bin/env node
// Validates .claude-plugin/marketplace.json and every plugin it references.
//
// Zero dependencies; runs in CI with no auth (see .github/workflows/validate.yml).
// Mirrors the checks described in docs/publishing-runbook.md section 4. Prints
// warnings for soft issues and exits non-zero on any hard error, so a broken
// manifest or plugin can never reach `master` (and therefore never reach a
// replace-all org sync).
//
// Run locally from the repo root:  node scripts/validate-marketplace.mjs

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const seen = new Set();

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function finish() {
  for (const w of warnings) console.log(`warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`\nMarketplace validation FAILED: ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`\nMarketplace validation passed: ${seen.size} plugin(s), ${warnings.length} warning(s).`);
  process.exit(0);
}

const manifestPath = join(repoRoot, '.claude-plugin', 'marketplace.json');
if (!existsSync(manifestPath)) {
  err('Missing marketplace manifest: .claude-plugin/marketplace.json');
  finish();
}

let manifest;
try {
  manifest = readJson(manifestPath);
} catch (e) {
  err(`marketplace.json is not valid JSON: ${e.message}`);
  finish();
}

if (!manifest.name) err('marketplace.json: missing required "name"');
if (!manifest.owner || !manifest.owner.name) err('marketplace.json: missing required "owner.name"');
if (!Array.isArray(manifest.plugins)) {
  err('marketplace.json: "plugins" must be an array');
  finish();
}

const semverish = /^\d+\.\d+\.\d+([-+].+)?$/;

for (const [i, p] of manifest.plugins.entries()) {
  const label = p && p.name ? `plugin "${p.name}"` : `plugins[${i}]`;
  if (!p || typeof p !== 'object') { err(`${label}: not an object`); continue; }
  if (!p.name) { err(`${label}: missing "name"`); continue; }
  if (seen.has(p.name)) err(`Duplicate plugin name "${p.name}"`);
  seen.add(p.name);
  if (!p.source) { err(`${label}: missing "source"`); continue; }

  if (typeof p.source === 'string') {
    if (!p.source.startsWith('./')) warn(`${label}: path source "${p.source}" should start with "./"`);
    const dir = resolve(repoRoot, p.source);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      err(`${label}: source path does not resolve to a directory: ${p.source}`);
      continue;
    }
    const pj = join(dir, '.claude-plugin', 'plugin.json');
    if (!existsSync(pj)) {
      warn(`${label}: no .claude-plugin/plugin.json (recommended)`);
    } else {
      let pm;
      try { pm = readJson(pj); }
      catch (e) { err(`${label}: plugin.json is not valid JSON: ${e.message}`); continue; }
      if (!pm.name) err(`${label}: plugin.json missing "name"`);
      else if (pm.name !== p.name) warn(`${label}: plugin.json name "${pm.name}" != marketplace entry name "${p.name}"`);
      if (pm.version && !semverish.test(pm.version)) err(`${label}: plugin.json version "${pm.version}" is not semver (x.y.z)`);
    }
  } else if (typeof p.source === 'object') {
    // Remote source (github / url / git-subdir / npm). CI can't fetch it, so
    // shape-check only; the real fetch happens at org sync time.
    const t = p.source.source || p.source.type;
    if (!t) warn(`${label}: remote source object has no "source"/"type" field`);
  } else {
    err(`${label}: "source" must be a path string or a source object`);
  }
}

finish();
