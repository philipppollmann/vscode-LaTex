import * as vscode from 'vscode';
import * as path from 'path';
import { LatexCompiler, CompilationStatus } from './latexCompiler';
import { PdfPreviewPanel } from './pdfPreview';

let compiler: LatexCompiler;
let statusBarItem: vscode.StatusBarItem;

/** Explicitly set main file (overrides active-editor fallback). */
let configuredMainFile: string | undefined;

export function activate(context: vscode.ExtensionContext): void {
  compiler = new LatexCompiler();

  // Status bar item: click to compile
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'latex.compile';
  setStatusBar('idle');
  statusBarItem.show();

  compiler.onStatusChange((status) => setStatusBar(status), null, context.subscriptions);

  // ── Commands ────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('latex.compile', async () => {
      const file = resolveMainFile();
      if (!file) { return; }
      const pdfPath = await compiler.compile(file);
      if (pdfPath) {
        PdfPreviewPanel.createOrShow(context, pdfPath);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('latex.showPreview', async () => {
      // Use cached PDF if available, otherwise compile first
      if (compiler.lastPdfPath) {
        PdfPreviewPanel.createOrShow(context, compiler.lastPdfPath);
        return;
      }
      const file = resolveMainFile();
      if (!file) { return; }
      const pdfPath = await compiler.compile(file);
      if (pdfPath) {
        PdfPreviewPanel.createOrShow(context, pdfPath);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('latex.setMainFile', async () => {
      const texFiles = await vscode.workspace.findFiles(
        '**/*.tex',
        '**/node_modules/**'
      );

      if (texFiles.length === 0) {
        vscode.window.showWarningMessage('No .tex files found in the workspace.');
        return;
      }

      const items = texFiles.map((uri) => ({
        label: vscode.workspace.asRelativePath(uri),
        uri,
      }));

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select the root .tex file to compile',
      });

      if (!picked) { return; }

      configuredMainFile = picked.uri.fsPath;

      // Also persist to workspace settings so the choice survives VS Code restarts
      const config = vscode.workspace.getConfiguration('latex');
      await config.update(
        'mainFile',
        picked.label,
        vscode.ConfigurationTarget.Workspace
      );

      vscode.window.showInformationMessage(`LaTeX main file: ${picked.label}`);

      // Immediately compile and open the preview
      const pdfPath = await compiler.compile(configuredMainFile);
      if (pdfPath) {
        PdfPreviewPanel.createOrShow(context, pdfPath);
      }
    })
  );

  // ── Auto-compile on save ─────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const cfg = vscode.workspace.getConfiguration('latex');
      if (!cfg.get<boolean>('autoCompile', true)) { return; }

      const isLatex =
        doc.languageId === 'latex' ||
        doc.fileName.endsWith('.tex') ||
        doc.fileName.endsWith('.bib');

      if (!isLatex) { return; }

      const file = resolveMainFile() ?? doc.fileName;
      const pdfPath = await compiler.compile(file);
      if (pdfPath) {
        PdfPreviewPanel.refresh(pdfPath);
      }
    })
  );

  // ── Restore configured main file from settings on activation ────────────

  const savedMain = vscode.workspace.getConfiguration('latex').get<string>('mainFile');
  if (savedMain) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
      configuredMainFile = path.join(root, savedMain);
    }
  }

  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(compiler);
}

export function deactivate(): void {
  compiler?.dispose();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveMainFile(): string | undefined {
  // 1. Explicitly configured via command or settings
  if (configuredMainFile) {
    return configuredMainFile;
  }

  // 2. Currently active .tex editor
  const active = vscode.window.activeTextEditor?.document;
  if (active && (active.languageId === 'latex' || active.fileName.endsWith('.tex'))) {
    return active.fileName;
  }

  // 3. Give up and prompt the user
  vscode.window
    .showWarningMessage(
      'No LaTeX file active. Open a .tex file or use "LaTeX: Set Main File".',
      'Set Main File'
    )
    .then((action) => {
      if (action === 'Set Main File') {
        vscode.commands.executeCommand('latex.setMainFile');
      }
    });

  return undefined;
}

function setStatusBar(status: CompilationStatus | 'idle'): void {
  switch (status) {
    case 'idle':
      statusBarItem.text = '$(file-pdf) LaTeX';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.tooltip = 'Click to compile (or save a .tex file)';
      break;
    case 'compiling':
      statusBarItem.text = '$(loading~spin) LaTeX: Compiling…';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.tooltip = 'Compiling…';
      break;
    case 'success':
      statusBarItem.text = '$(check) LaTeX: Done';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.tooltip = 'Compilation successful. Click to recompile.';
      // Fade back to idle after 3 s
      setTimeout(() => setStatusBar('idle'), 3000);
      break;
    case 'error':
      statusBarItem.text = '$(error) LaTeX: Error';
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
      statusBarItem.tooltip = 'Compilation failed – see LaTeX Compiler output';
      break;
  }
}
