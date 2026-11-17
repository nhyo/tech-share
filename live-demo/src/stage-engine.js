'use strict';

function normalizeEol(text) {
  return text.replace(/\r\n/g, '\n');
}

function findUnique(text, needle, label) {
  const first = text.indexOf(needle);
  if (first === -1) {
    throw new Error(`Cannot find edit anchor for ${label}`);
  }
  if (text.indexOf(needle, first + needle.length) !== -1) {
    throw new Error(`Edit anchor is not unique for ${label}`);
  }
  return first;
}

function applyOperation(text, operation) {
  const source = normalizeEol(text);
  const find = normalizeEol(operation.find);
  const insert = normalizeEol(operation.text ?? '');
  const index = findUnique(source, find, operation.label);

  if (operation.kind === 'replace') {
    return source.slice(0, index) + insert + source.slice(index + find.length);
  }
  if (operation.kind === 'insertBefore') {
    return source.slice(0, index) + insert + source.slice(index);
  }
  if (operation.kind === 'insertAfter') {
    const end = index + find.length;
    return source.slice(0, end) + insert + source.slice(end);
  }
  throw new Error(`Unknown operation kind: ${operation.kind}`);
}

function applyStage(files, stage) {
  const next = { ...files };
  for (const operation of stage.operations) {
    if (operation.kind === 'createFile') {
      if (operation.file in next) {
        throw new Error(`Cannot create existing file for ${operation.label}: ${operation.file}`);
      }
      next[operation.file] = normalizeEol(operation.text ?? '');
      continue;
    }
    if (!(operation.file in next)) {
      throw new Error(`Missing file for ${operation.label}: ${operation.file}`);
    }
    next[operation.file] = applyOperation(next[operation.file], operation);
  }
  return next;
}

function buildCheckpoints(initialFiles, stages) {
  const checkpoints = [{ ...initialFiles }];
  for (const stage of stages) {
    checkpoints.push(applyStage(checkpoints.at(-1), stage));
  }
  return checkpoints;
}

function checkpointIndex(files, checkpoints) {
  const paths = Object.keys(checkpoints[0]);
  return checkpoints.findIndex((checkpoint) =>
    paths.every((file) => normalizeEol(files[file]) === normalizeEol(checkpoint[file]))
  );
}

class StageStateMachine {
  constructor(stageCount, completedStages = 0) {
    this.stageCount = stageCount;
    this.completedStages = completedStages;
    this.running = false;
    this.paused = false;
  }

  beginNext() {
    if (this.running || this.completedStages >= this.stageCount) return false;
    this.running = true;
    this.paused = false;
    return true;
  }

  complete() {
    if (!this.running) return false;
    this.running = false;
    this.paused = false;
    this.completedStages += 1;
    return true;
  }

  interrupt() {
    this.running = false;
    this.paused = false;
  }

  togglePause() {
    if (!this.running) return false;
    this.paused = !this.paused;
    return this.paused;
  }

  restore(completedStages) {
    if (completedStages < 0 || completedStages > this.stageCount) {
      throw new Error('Invalid checkpoint');
    }
    this.completedStages = completedStages;
    this.interrupt();
  }
}

module.exports = {
  StageStateMachine,
  applyOperation,
  applyStage,
  buildCheckpoints,
  checkpointIndex,
  findUnique,
  normalizeEol
};
