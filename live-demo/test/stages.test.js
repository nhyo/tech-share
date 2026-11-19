'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  StageStateMachine,
  applyStage,
  buildCheckpoints,
  checkpointIndex,
  normalizeEol
} = require('../src/stage-engine');
const { PAGE, SERVER, chapters, stages } = require('../src/stages');

const repositoryRoot = path.resolve(__dirname, '..', '..');

function read(folder, file) {
  return normalizeEol(fs.readFileSync(path.join(repositoryRoot, folder, file), 'utf8'));
}

function checkpoints() {
  return buildCheckpoints(
    {
      [PAGE]: read('demo', PAGE),
      [SERVER]: read('demo', SERVER)
    },
    stages
  );
}

test('all micro-steps apply deterministically, one code unit per Enter', () => {
  const all = checkpoints();
  assert.equal(stages.length, 24);
  assert.equal(all.length, 25);
  assert.equal(stages.every((stage) => stage.operations.length === 1), true);

  let chapterState = all[0];
  const chapterEnds = [];
  for (const chapter of chapters) {
    chapterState = applyStage(chapterState, chapter);
    chapterEnds.push(chapterState);
  }

  assert.match(chapterEnds[0][PAGE], /Selected: \{selectedFile\.name\}/);
  assert.match(chapterEnds[1][SERVER], /handleUpload\(/);
  assert.match(chapterEnds[1][PAGE], /multipart: selectedFile\.size/);
  assert.match(chapterEnds[2][SERVER], /export const GET/);
  assert.match(chapterEnds[2][PAGE], /Load Gallery/);
  assert.match(chapterEnds[3][SERVER], /export const DELETE/);
  assert.match(chapterEnds[3][PAGE], /deleteImage\(item\.pathname\)/);
});

test('final generated presentation files exactly match finial', () => {
  const final = checkpoints().at(-1);
  assert.equal(final[PAGE], read('finial', PAGE));
  assert.equal(final[SERVER], read('finial', SERVER));
});

test('checkpoint detection rejects unexpected modifications', () => {
  const all = checkpoints();
  assert.equal(checkpointIndex(all[2], all), 2);
  assert.equal(
    checkpointIndex({ ...all[2], [PAGE]: `${all[2][PAGE]}\n// unexpected` }, all),
    -1
  );
});

test('state machine prevents double-triggering and supports restore', () => {
  const machine = new StageStateMachine(stages.length);
  assert.equal(machine.beginNext(), true);
  assert.equal(machine.beginNext(), false);
  assert.equal(machine.togglePause(), true);
  assert.equal(machine.togglePause(), false);
  assert.equal(machine.complete(), true);
  assert.equal(machine.completedStages, 1);
  machine.restore(0);
  assert.equal(machine.completedStages, 0);
  assert.equal(machine.running, false);
});

test('edit engine supports creating a new file for future presentations', () => {
  const result = applyStage({}, {
    operations: [
      {
        kind: 'createFile',
        file: 'src/new-file.ts',
        label: 'create a backend module',
        text: 'export const ready = true;\n'
      }
    ]
  });
  assert.equal(result['src/new-file.ts'], 'export const ready = true;\n');
});
