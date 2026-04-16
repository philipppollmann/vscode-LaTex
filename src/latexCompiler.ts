import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export type CompilationStatus = 'compiling' | 'success' | 'error';

export class LatexCompiler implements vscode.Disposable {
  private readonly _onStatusChange = new vscode.EventEmitter<CompilationStatus>();
  readonly onStatusChange = this._onStatusChange.event;

  private currentProcess: cp.ChildProcess | undefined;
  private readonly outputChannel: vscode.OutputChannel;

  /** Path of the most recently compiled PDF (undefined if never compiled). */
  lastPdfPath: string | undefined;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('LaTeX Compiler');
  }

  async compile(texFilePath: string): Promise<string | undefined> {
    // Kill any in-progress compile (rapid save → always compile the latest version)
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = undefined;
    }

    const config = vscode.workspace.getConfiguration('latex');
    const latexmkBin: string = config.get('latexmkPath', '/Library/TeX/texbin/latexmk');
    const outDirRel: string = config.get('outputDir', 'out');
    const extraArgs: string[] = config.get('extraArgs', []);

    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(texFilePath);
    const outDir = path.isAbsolute(outDirRel)
      ? outDirRel
      : path.join(workspaceRoot, outDirRel);

    fs.mkdirSync(outDir, { recursive: true });

    const args = [
      '-pdf',
      '-interaction=nonstopmode',
      '-halt-on-error',
      `-outdir=${outDir}`,
      ...extraArgs,
      texFilePath,
    ];

    this._onStatusChange.fire('compiling');
    this.outputChannel.clear();
    this.outputChannel.appendLine(`[LaTeX] Compiling: ${path.basename(texFilePath)}`);
    this.outputChannel.appendLine(`[LaTeX] Command: latexmk ${args.join(' ')}\n`);

    return new Promise<string | undefined>((resolve) => {
      const env = {
        ...process.env,
        // Ensure TeX binaries are on PATH when VS Code is launched from Finder/Dock
        PATH: `/Library/TeX/texbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ''}`,
      };

      const proc = cp.spawn(latexmkBin, args, { cwd: workspaceRoot, env });
      this.currentProcess = proc;

      proc.stdout?.on('data', (chunk: Buffer) =>
        this.outputChannel.append(chunk.toString())
      );
      proc.stderr?.on('data', (chunk: Buffer) =>
        this.outputChannel.append(chunk.toString())
      );

      proc.on('error', (err: NodeJS.ErrnoException) => {
        this.currentProcess = undefined;
        this._onStatusChange.fire('error');
        vscode.window.showErrorMessage(
          `LaTeX: Cannot start latexmk – ${err.message}. ` +
          `Check the "latex.latexmkPath" setting.`
        );
        resolve(undefined);
      });

      proc.on('close', (code: number | null) => {
        this.currentProcess = undefined;

        // code === null means we killed the process (rapid save); not an error
        if (code === null) {
          resolve(undefined);
          return;
        }

        if (code === 0) {
          const baseName = path.basename(texFilePath, '.tex');
          const pdfPath = path.join(outDir, `${baseName}.pdf`);
          if (fs.existsSync(pdfPath)) {
            this._onStatusChange.fire('success');
            this.lastPdfPath = pdfPath;
            this.outputChannel.appendLine(`\n[LaTeX] ✓ Done → ${pdfPath}`);
            resolve(pdfPath);
          } else {
            this._onStatusChange.fire('error');
            this.outputChannel.appendLine(`\n[LaTeX] ✗ PDF not found at ${pdfPath}`);
            this.outputChannel.show(true);
            resolve(undefined);
          }
        } else {
          this._onStatusChange.fire('error');
          this.outputChannel.appendLine(`\n[LaTeX] ✗ Compilation failed (exit ${code})`);
          this.outputChannel.show(true);
          vscode.window
            .showErrorMessage('LaTeX compilation failed.', 'Show Output')
            .then((action) => {
              if (action === 'Show Output') {
                this.outputChannel.show();
              }
            });
          resolve(undefined);
        }
      });
    });
  }

  dispose(): void {
    this.currentProcess?.kill();
    this.outputChannel.dispose();
    this._onStatusChange.dispose();
  }
}
