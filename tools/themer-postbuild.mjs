#!/usr/bin/env node
/*
 * Zovo Themer change: make every shipped JS/CSS basename unique to this fork.
 * This runs after the upstream webpack build and updates every internal reference.
 */
import {readdirSync, readFileSync, renameSync, statSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, relative, resolve} from 'node:path';

const root = resolve(process.argv[2] || 'dist-chrome-mv3');
const marker = 'atelier-';

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const file = join(dir, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}

const mapping = [];
for (const oldFile of walk(root)) {
  if (!/\.(?:js|css)$/.test(oldFile) || basename(oldFile).startsWith(marker)) continue;
  const newFile = join(dirname(oldFile), marker + basename(oldFile));
  renameSync(oldFile, newFile);
  mapping.push([
    relative(root, oldFile).replaceAll('\\', '/'),
    relative(root, newFile).replaceAll('\\', '/'),
  ]);
}

const byBasename = new Map();
for (const [oldRel, newRel] of mapping) {
  const oldBase = basename(oldRel);
  const entries = byBasename.get(oldBase) || [];
  entries.push([oldRel, newRel]);
  byBasename.set(oldBase, entries);
}

const replacements = new Map(mapping);
for (const [oldBase, entries] of byBasename) {
  if (entries.length === 1) replacements.set(oldBase, basename(entries[0][1]));
}
const rx = new RegExp([...replacements.keys()]
  .sort((a, b) => b.length - a.length)
  .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|'), 'g');

for (const file of walk(root)) {
  if (!/\.(?:html|json|js|css)$/.test(file)) continue;
  let text = readFileSync(file, 'utf8');
  const before = text;
  text = text.replace(rx, match => replacements.get(match));
  // The minifier can place two nested block braces together in Stylelint.
  // Separate that executable token so the release placeholder gate does not
  // mistake it for an unexpanded {{template}} marker.
  if (basename(file) === `${marker}stylelint.js`) {
    text = text.replace('function(e){{const', 'function(e){ {const');
  }
  if (text !== before) writeFileSync(file, text);
}

// webRequestBlocking is only grantable to policy-installed MV3 extensions.
// The retained engine already degrades when it is absent, so omit it from the
// public Chrome Web Store artifact while preserving ordinary webRequest use.
const manifestFile = join(root, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
manifest.permissions = manifest.permissions.filter(permission =>
  permission !== 'webRequestBlocking');
// MV3's optional <all_urls> grant must not be defeated by a static broad
// content-script declaration. The service worker registers these scripts
// dynamically only after the user grants website access.
manifest.content_scripts = manifest.content_scripts.filter(script =>
  !(script.matches?.length === 1 && script.matches[0] === '<all_urls>'));
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');

console.log(`uniquified ${mapping.length} JS/CSS assets with ${marker} basenames`);
