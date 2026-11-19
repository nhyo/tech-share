# Automated VS Code Live-Coding Demo

This extension turns an already prepared `practice` source into the current `finial` source through four teaching chapters and 24 small editing steps. Each Enter writes exactly one coherent unit: a variable definition, import block, complete function or endpoint, complete HTML control/block, or one focused cleanup. It edits only the gitignored `practice` copy and does not perform the pre-class copy, dependency, environment, or server setup.

## Install once before class

From the repository root:

```powershell
cd live-demo
npm test
npm run package
code --install-extension .\vercel-blob-live-demo-1.0.3.vsix --force
code ..
```

Reload VS Code if it was already open. The packaged extension contains no runtime npm dependencies.

For extension development, open the repository in VS Code and press F5. The included launch configuration opens an Extension Development Host with this repository.

## Prepare the classroom workspace

1. From the repository root, create `practice` yourself with `Copy-Item -Recurse demo practice` (or the equivalent command for your shell).
2. In `practice`, run `npm install` once.
3. Copy `.env.example` to `.env.local` and set `BLOB_READ_WRITE_TOKEN`.
4. Start `npm run dev` in the integrated terminal and leave it running.
5. Run **Vercel Blob Demo: Start Presentation Mode** from the Command Palette.
6. Return focus to the source editor. The status bar shows the next Stage and Step; press Enter once for each small code unit.

If `practice` or either presentation source file is missing, the extension stops with a setup message. It does not create or repair the workspace automatically.

Enter is intercepted only when presentation mode is active and a text editor has focus. It is not intercepted in the integrated terminal. Exiting presentation mode restores normal editor behavior.

## Presenter controls

| Action | Control |
| --- | --- |
| Start presentation mode | Command Palette: **Vercel Blob Demo: Start Presentation Mode** |
| Run the next small step | **Enter** while the editor is focused, or click the status item |
| Pause/resume typing | **Ctrl+Alt+P** |
| Skip the animation and complete the step | **Ctrl+Alt+S** |
| Restart the pending/current step | Command Palette: **Vercel Blob Demo: Restart Current Step** |
| Reset to the untouched demo | Command Palette: **Vercel Blob Demo: Restart from Stage 0** |
| Restore any known checkpoint | Command Palette: **Vercel Blob Demo: Restore Checkpoint** |
| Exit and restore normal Enter | Command Palette: **Vercel Blob Demo: Exit Presentation Mode** |

Typing speed is configured with `vercelBlobDemo.typingDelayMs`. The extension enforces the presentation range of 20–60 ms per character and defaults to 28 ms.

`vercelBlobDemo.showEditorEffects` defaults to `true`. The extension keeps deterministic character-by-character edits while explicitly asking VS Code to display IntelliSense after expressions such as `request.` and parameter hints after function calls. Syntax highlighting and diagnostics continue to come from the normal Svelte and TypeScript language support. Suggestions are closed at the end of each edit operation so they cannot consume the Enter intended for the next stage.

## Stage guide

### Stage 1 — Select a file (4 steps)

- Defines `selectedFile` and `error` separately.
- Creates the complete file input.
- Creates the selected-filename block.

### Stage 2 — Upload with Vercel Blob (9 steps)

- Adds the minimal backend imports and the complete `handleUpload()` POST endpoint.
- Adds the browser upload import and `imageUrl` state.
- Adds the complete `uploadImage()` function.
- Creates the Upload button, error block, and image/video preview as separate steps.
- Removes the unused starter `.message` style instead of carrying dead code into `finial`.

### Stage 3 — Load the cloud gallery (7 steps)

- Adds the gallery type, state, and `loadImages()` frontend request.
- Switches to the backend to import `list()` and add the GET endpoint.
- Returns to the page to render persistent images and videos.

### Stage 4 — Delete a selected Blob (4 steps)

- Adds the `del()` import.
- Adds the frontend DELETE request and automatic gallery refresh.
- Adds backend pathname validation and the DELETE endpoint.
- Finishes by adding the Delete button to each gallery card.

This preserves the four teaching objectives while making every Enter small and predictable. The final backend contains only the active client-upload implementation; the obsolete commented `formData()/put()` path and unused state are not generated.

## Reliability and recovery

- Every one of the 24 steps has a deterministic start and end checkpoint.
- Before a step runs, both edited files must match its expected starting checkpoint.
- Unexpected edits stop progression and offer to restore the last safe checkpoint.
- A second Enter while a stage is running is ignored.
- Skip applies the exact completed step checkpoint, not a partially typed result.
- Presentation state is stored in VS Code workspace state. After a crash or reload, starting presentation mode detects a complete checkpoint; if the files are partial, it offers the last saved checkpoint.
- Restart and restore touch only `practice/src/routes/+page.svelte` and `practice/src/routes/api/blob/+server.ts`. They preserve `.env.local`, installed dependencies, and all originals under `demo` and `finial`.

## Matching policy

At Stage 4 completion, the generated entire `practice/src` tree matches `finial/src` after normalizing line endings. `practice/package.json` keeps the demo package name, and demo-only sample assets remain available; neither difference affects the application source or classroom behavior.

## Test and package

```powershell
npm test
npm run verify
npm run package
```

- `npm test` checks all operations, checkpoints, unexpected-change detection, double-trigger prevention, pause state, and restore state.
- `npm run verify` replays all stages and compares every generated source file with `finial`.
- `npm run package` produces the installable VSIX.

The real Vercel upload/list/delete flow requires a valid `BLOB_READ_WRITE_TOKEN` and a public Blob store. No credential is embedded in the extension or test suite.
