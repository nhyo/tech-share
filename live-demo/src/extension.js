'use strict';

const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  StageStateMachine,
  buildCheckpoints,
  checkpointIndex,
  findUnique,
  normalizeEol
} = require('./stage-engine');
const { PAGE, SERVER, stages } = require('./stages');

const TRACKED_FILES = [PAGE, SERVER];
const SESSION_KEY = 'vercelBlobDemo.session';

class DemoController {
  constructor(context) {
    this.context = context;
    this.root = undefined;
    this.practiceRoot = undefined;
    this.checkpoints = undefined;
    this.machine = undefined;
    this.active = false;
    this.internalEdit = false;
    this.skipRequested = false;
    this.abortReason = undefined;
    this.currentRun = undefined;

    this.output = vscode.window.createOutputChannel('Vercel Blob Live Demo');
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.status.command = 'vercelBlobDemo.nextStage';
    context.subscriptions.push(this.output, this.status);
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => this.onDocumentChanged(event))
    );
  }

  async start() {
    if (this.active) {
      vscode.window.showInformationMessage('Vercel Blob presentation mode is already active.');
      return;
    }

    this.root = await this.findRepositoryRoot();
    if (!this.root) {
      vscode.window.showErrorMessage('Open the tech-share repository root, then start presentation mode again.');
      return;
    }

    this.practiceRoot = path.join(this.root, 'practice');
    if (!(await this.ensurePracticeReady())) return;
    this.checkpoints = await this.createCheckpoints();

    let actualFiles = await this.readTrackedFiles(this.practiceRoot);
    let completedStages = checkpointIndex(actualFiles, this.checkpoints);

    if (completedStages === -1) {
      const saved = this.context.workspaceState.get(SESSION_KEY);
      const fallback = saved?.root === this.root
        ? Math.max(0, Math.min(stages.length, saved.completedStages ?? 0))
        : 0;
      const choice = await vscode.window.showWarningMessage(
        'The practice code does not match a known checkpoint. Restore the last safe checkpoint before presenting?',
        { modal: true },
        `Restore Checkpoint ${fallback}`,
        'Cancel'
      );
      if (choice !== `Restore Checkpoint ${fallback}`) return;
      await this.writeCheckpoint(fallback);
      completedStages = fallback;
      actualFiles = this.checkpoints[fallback];
    }

    await this.writeCheckpoint(completedStages);
    this.machine = new StageStateMachine(stages.length, completedStages);
    this.active = true;
    await vscode.commands.executeCommand('setContext', 'vercelBlobDemo.presentationMode', true);
    await this.saveSession(false);
    await this.showFileForNextStage();
    this.updateStatus();
    this.output.appendLine(`Presentation mode started at checkpoint ${completedStages}.`);
    this.output.show(true);
    vscode.window.showInformationMessage(
      completedStages === stages.length
        ? 'The demonstration is already complete. Use Restart or Restore Checkpoint to run it again.'
        : `Presentation mode ready. Press Enter to start ${stages[completedStages].title}.`
    );
  }

  async nextStage() {
    if (!this.active || !this.machine) {
      await this.start();
      return;
    }
    if (this.machine.running) {
      vscode.window.setStatusBarMessage('A demo stage is already running.', 1800);
      return;
    }
    if (this.machine.completedStages >= stages.length) {
      vscode.window.showInformationMessage('All presentation steps are complete.');
      return;
    }

    const startIndex = this.machine.completedStages;
    const actual = await this.readTrackedFiles(this.practiceRoot);
    if (checkpointIndex(actual, [this.checkpoints[startIndex]]) !== 0) {
      this.updateStatus('Unexpected edits detected');
      const choice = await vscode.window.showWarningMessage(
        `Practice files changed after checkpoint ${startIndex}. Restore it before continuing?`,
        { modal: true },
        'Restore and Continue',
        'Cancel'
      );
      if (choice !== 'Restore and Continue') return;
      await this.writeCheckpoint(startIndex);
    }

    if (!this.machine.beginNext()) return;
    this.skipRequested = false;
    this.abortReason = undefined;
    await this.saveSession(true);
    const stage = stages[startIndex];
    this.currentRun = this.runStage(stage, startIndex);
    await this.currentRun;
    this.currentRun = undefined;
  }

  async runStage(stage, startIndex) {
    this.output.appendLine(`Starting ${stage.title}: ${stage.objective}`);
    this.updateStatus(stage.title);

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: stage.title,
          cancellable: false
        },
        async (progress) => {
          for (let index = 0; index < stage.operations.length; index += 1) {
            if (this.skipRequested || this.abortReason) break;
            const operation = stage.operations[index];
            progress.report({
              message: operation.label,
              increment: 100 / stage.operations.length
            });
            this.updateStatus(`${stage.title} · ${operation.label}`);
            await this.animateOperation(operation);
          }
        }
      );

      if (this.abortReason) {
        this.machine.interrupt();
        this.output.appendLine(`${stage.title} interrupted: ${this.abortReason}.`);
        return;
      }

      if (this.skipRequested) {
        await this.writeCheckpoint(startIndex + 1);
        this.output.appendLine(`${stage.title} animation skipped; completed checkpoint applied.`);
      }

      const actual = await this.readTrackedFiles(this.practiceRoot);
      if (checkpointIndex(actual, [this.checkpoints[startIndex + 1]]) !== 0) {
        throw new Error(`${stage.title} did not produce its expected checkpoint`);
      }

      this.machine.complete();
      await this.saveSession(false);
      this.updateStatus();
      this.output.appendLine(`${stage.title} complete and verified.`);
      await this.showFileForNextStage();

      if (this.machine.completedStages === stages.length) {
        vscode.window.showInformationMessage('All live-coding steps are complete. The practice source matches finial.');
      } else {
        vscode.window.setStatusBarMessage(
          `${stage.title} complete. Press Enter for ${stages[this.machine.completedStages].title}.`,
          5000
        );
      }
    } catch (error) {
      this.machine.interrupt();
      await this.saveSession(true);
      this.updateStatus('Interrupted · restore current checkpoint');
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`ERROR: ${message}`);
      this.output.show(true);
      vscode.window.showErrorMessage(`Demo stage interrupted: ${message}`);
    }
  }

  async animateOperation(operation) {
    const uri = vscode.Uri.file(path.join(this.practiceRoot, operation.file));
    if (operation.kind === 'createFile') {
      await fs.mkdir(path.dirname(uri.fsPath), { recursive: true });
      try {
        await fs.access(uri.fsPath);
        throw new Error(`Cannot create an existing file: ${operation.file}`);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      await fs.writeFile(uri.fsPath, '', 'utf8');
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });

    const current = normalizeEol(document.getText());
    const find = normalizeEol(operation.find);
    const index = findUnique(current, find, operation.label);
    let insertionOffset;

    if (operation.kind === 'createFile') {
      insertionOffset = 0;
    } else if (operation.kind === 'replace') {
      const start = document.positionAt(index);
      const end = document.positionAt(index + find.length);
      editor.selection = new vscode.Selection(start, end);
      editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      await this.delay(180);
      await this.editDocument(editor, (builder) => builder.delete(new vscode.Range(start, end)));
      insertionOffset = index;
    } else if (operation.kind === 'insertBefore') {
      insertionOffset = index;
    } else if (operation.kind === 'insertAfter') {
      insertionOffset = index + find.length;
    } else {
      throw new Error(`Unknown operation kind: ${operation.kind}`);
    }

    const typedText = normalizeEol(operation.text ?? '');
    const delayMs = this.typingDelayMs();
    for (let characterIndex = 0; characterIndex < typedText.length; characterIndex += 1) {
      const character = typedText[characterIndex];
      if (this.skipRequested || this.abortReason) return;
      while (this.machine?.paused && !this.abortReason && !this.skipRequested) {
        await this.delay(80);
      }
      if (this.skipRequested || this.abortReason) return;

      const position = editor.document.positionAt(insertionOffset);
      await this.editDocument(editor, (builder) => builder.insert(position, character));
      insertionOffset += character.length;
      const cursor = editor.document.positionAt(insertionOffset);
      editor.selection = new vscode.Selection(cursor, cursor);
      editor.revealRange(new vscode.Range(cursor, cursor), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      await this.delay(delayMs);
      await this.showEditorEffect(character, typedText[characterIndex - 1]);
    }
    await this.hideSuggestions();
    await editor.document.save();
    await this.delay(220);
  }

  async showEditorEffect(character, previousCharacter) {
    const enabled = vscode.workspace
      .getConfiguration('vercelBlobDemo')
      .get('showEditorEffects', true);
    if (!enabled || this.skipRequested || this.abortReason || this.machine?.paused) return;

    try {
      if (character === '.' && /[\w)\]]/.test(previousCharacter ?? '')) {
        await vscode.commands.executeCommand('editor.action.triggerSuggest');
        await this.delay(160);
      } else if (character === '(' && /[\w]/.test(previousCharacter ?? '')) {
        await vscode.commands.executeCommand('editor.action.triggerParameterHints');
        await this.delay(100);
      } else if (character === '\n') {
        await this.hideSuggestions();
      }
    } catch (error) {
      this.output.appendLine(
        `Editor effect unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async hideSuggestions() {
    try {
      await vscode.commands.executeCommand('hideSuggestWidget');
    } catch {
      // A language provider may not have registered its suggestion widget yet.
    }
  }

  async pauseResume() {
    if (!this.machine?.running) {
      vscode.window.showInformationMessage('No step is currently typing.');
      return;
    }
    const paused = this.machine.togglePause();
    this.updateStatus(paused ? 'Paused · Ctrl+Alt+P to resume' : 'Resumed');
    this.output.appendLine(paused ? 'Typing paused.' : 'Typing resumed.');
  }

  async skipStage() {
    if (!this.machine?.running) {
      vscode.window.showInformationMessage('No running step to skip.');
      return;
    }
    this.skipRequested = true;
    this.updateStatus('Completing current stage immediately');
  }

  async restartStage() {
    if (!this.active || !this.machine) return;
    let checkpoint = this.machine.completedStages;
    if (checkpoint >= stages.length) checkpoint = stages.length - 1;
    await this.interruptRun('restart stage');
    await this.writeCheckpoint(checkpoint);
    this.machine.restore(checkpoint);
    await this.saveSession(false);
    this.updateStatus();
    await this.nextStage();
  }

  async restartDemo() {
    if (!this.active || !this.machine) return;
    const answer = await vscode.window.showWarningMessage(
      'Restart from Stage 0? This resets the two presentation source files in practice. Credentials and dependencies are preserved.',
      { modal: true },
      'Restart Demo'
    );
    if (answer !== 'Restart Demo') return;
    await this.interruptRun('restart demo');
    await this.writeCheckpoint(0);
    this.machine.restore(0);
    await this.saveSession(false);
    await this.showFileForNextStage();
    this.updateStatus();
  }

  async restoreCheckpoint() {
    if (!this.active || !this.machine) return;
    const items = this.checkpoints.map((_, index) => ({
      label: index === 0 ? 'Checkpoint 0 · Clean practice starting point' : `Checkpoint ${index} · ${stages[index - 1].title}`,
      description: index === stages.length ? 'Final source' : '',
      index
    }));
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Choose a known checkpoint to restore'
    });
    if (!picked) return;
    await this.interruptRun('restore checkpoint');
    await this.writeCheckpoint(picked.index);
    this.machine.restore(picked.index);
    await this.saveSession(false);
    await this.showFileForNextStage();
    this.updateStatus();
  }

  async stop() {
    if (!this.active) return;
    const checkpoint = this.machine?.completedStages ?? 0;
    await this.interruptRun('exit presentation mode');
    if (this.machine?.running || this.abortReason) {
      await this.writeCheckpoint(checkpoint);
      this.machine?.restore(checkpoint);
    }
    this.active = false;
    await vscode.commands.executeCommand('setContext', 'vercelBlobDemo.presentationMode', false);
    this.status.hide();
    await this.saveSession(false);
    this.output.appendLine('Presentation mode stopped. Normal Enter behavior restored.');
  }

  async interruptRun(reason) {
    if (!this.machine?.running || !this.currentRun) return;
    this.abortReason = reason;
    this.machine.paused = false;
    await this.currentRun;
    this.currentRun = undefined;
  }

  async ensurePracticeReady() {
    try {
      await Promise.all([
        fs.access(this.practiceRoot),
        ...TRACKED_FILES.map((file) => fs.access(path.join(this.practiceRoot, file)))
      ]);
      return true;
    } catch {
      vscode.window.showErrorMessage(
        'The practice workspace is not ready. Create practice from demo and finish the npm/environment setup before starting presentation mode.'
      );
      return false;
    }
  }

  async createCheckpoints() {
    const initial = await this.readTrackedFiles(path.join(this.root, 'demo'));
    return buildCheckpoints(initial, stages);
  }

  async readTrackedFiles(base) {
    const entries = await Promise.all(
      TRACKED_FILES.map(async (file) => [file, normalizeEol(await fs.readFile(path.join(base, file), 'utf8'))])
    );
    return Object.fromEntries(entries);
  }

  async writeCheckpoint(index) {
    const checkpoint = this.checkpoints[index];
    this.internalEdit = true;
    try {
      for (const file of TRACKED_FILES) {
        const target = path.join(this.practiceRoot, file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        const document = vscode.workspace.textDocuments.find((item) => item.uri.fsPath === target);
        if (document) {
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );
          edit.replace(document.uri, fullRange, checkpoint[file]);
          const applied = await vscode.workspace.applyEdit(edit);
          if (!applied) throw new Error(`Could not restore ${file}`);
          await document.save();
        } else {
          await fs.writeFile(target, checkpoint[file], 'utf8');
        }
      }
    } finally {
      this.internalEdit = false;
    }
    this.output.appendLine(`Restored checkpoint ${index}.`);
  }

  async editDocument(editor, callback) {
    this.internalEdit = true;
    try {
      const applied = await editor.edit(callback, { undoStopBefore: false, undoStopAfter: false });
      if (!applied) throw new Error('VS Code rejected an automated edit');
    } finally {
      this.internalEdit = false;
    }
  }

  onDocumentChanged(event) {
    if (!this.active || this.internalEdit || !this.practiceRoot) return;
    const relative = path.relative(this.practiceRoot, event.document.uri.fsPath).replaceAll('\\', '/');
    if (TRACKED_FILES.includes(relative)) {
      this.updateStatus('External edit detected · checkpoint will be checked');
      this.output.appendLine(`External edit detected in ${relative}.`);
    }
  }

  async showFileForNextStage() {
    if (!this.practiceRoot || !this.machine) return;
    const nextStep = stages[this.machine.completedStages];
    const relative = nextStep?.operations[0]?.file ?? SERVER;
    const document = await vscode.workspace.openTextDocument(path.join(this.practiceRoot, relative));
    await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false });
  }

  updateStatus(detail) {
    if (!this.active || !this.machine) return;
    if (detail) {
      this.status.text = `$(record) Blob Demo: ${detail}`;
    } else if (this.machine.completedStages >= stages.length) {
      this.status.text = '$(pass-filled) Blob Demo: Complete';
    } else {
      const next = stages[this.machine.completedStages];
      this.status.text = `$(debug-step-over) Blob Demo: Enter · Stage ${next.chapterNumber} Step ${next.stepNumber}/${next.stepsInChapter}`;
    }
    this.status.tooltip = 'Click to run the next stage. Enter works only while presentation mode and the editor are focused.';
    this.status.show();
  }

  typingDelayMs() {
    const configured = vscode.workspace.getConfiguration('vercelBlobDemo').get('typingDelayMs', 28);
    return Math.max(20, Math.min(60, Number(configured) || 28));
  }

  async saveSession(running) {
    if (!this.root || !this.machine) return;
    await this.context.workspaceState.update(SESSION_KEY, {
      root: this.root,
      completedStages: this.machine.completedStages,
      running,
      updatedAt: new Date().toISOString()
    });
  }

  async findRepositoryRoot() {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const demo = path.join(folder.uri.fsPath, 'demo');
      const finial = path.join(folder.uri.fsPath, 'finial');
      try {
        await Promise.all([fs.access(demo), fs.access(finial)]);
        return folder.uri.fsPath;
      } catch {
        // Continue to the next workspace folder.
      }
    }
    return undefined;
  }

  delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

function activate(context) {
  const controller = new DemoController(context);
  const commands = {
    'vercelBlobDemo.start': () => controller.start(),
    'vercelBlobDemo.nextStage': () => controller.nextStage(),
    'vercelBlobDemo.pauseResume': () => controller.pauseResume(),
    'vercelBlobDemo.skipStage': () => controller.skipStage(),
    'vercelBlobDemo.restartStage': () => controller.restartStage(),
    'vercelBlobDemo.restartDemo': () => controller.restartDemo(),
    'vercelBlobDemo.restoreCheckpoint': () => controller.restoreCheckpoint(),
    'vercelBlobDemo.stop': () => controller.stop()
  };
  for (const [name, handler] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(name, handler));
  }
}

function deactivate() {}

module.exports = { activate, deactivate, DemoController };
