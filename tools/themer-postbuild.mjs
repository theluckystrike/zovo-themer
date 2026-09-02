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
  if (text !== before) writeFileSync(file, text);
}

console.log(`uniquified ${mapping.length} JS/CSS assets with ${marker} basenames`);
