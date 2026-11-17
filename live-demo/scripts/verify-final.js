'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildCheckpoints, normalizeEol } = require('../src/stage-engine');
const { PAGE, SERVER, stages } = require('../src/stages');

const root = path.resolve(__dirname, '..', '..');

function walk(folder, base = folder) {
  const result = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith('.env')) continue;
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute, base));
    else result.push(path.relative(base, absolute).replaceAll('\\', '/'));
  }
  return result.sort();
}

function read(base, relative) {
  return normalizeEol(fs.readFileSync(path.join(base, relative), 'utf8'));
}

const demo = path.join(root, 'demo');
const finial = path.join(root, 'finial');
const generated = buildCheckpoints(
  {
    [PAGE]: read(demo, PAGE),
    [SERVER]: read(demo, SERVER)
  },
  stages
).at(-1);

const demoSourceFiles = walk(path.join(demo, 'src'));
const finalSourceFiles = walk(path.join(finial, 'src'));
assert.deepEqual(demoSourceFiles, finalSourceFiles, 'demo and finial source trees must contain the same files');

for (const relativeFromSrc of finalSourceFiles) {
  const relative = `src/${relativeFromSrc}`;
  const actual = relative in generated ? generated[relative] : read(demo, relative);
  assert.equal(actual, read(finial, relative), `generated ${relative} differs from finial`);
}

console.log(`Verified ${finalSourceFiles.length} generated source files against finial.`);
