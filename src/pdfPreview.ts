import * as vscode from 'vscode';
import * as fs from 'fs';

export class PdfPreviewPanel {
  private static instance: PdfPreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly context: vscode.ExtensionContext,
    pdfPath: string
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'latexPdfPreview',
      'LaTeX Preview',
      // Open beside the editor, keep focus in the editor
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        // Only allow resources from our media/ folder
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
        // Keep the rendered PDF in memory when the panel is hidden
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.buildHtml();

    // Small delay so the webview has time to set up its message listener
    setTimeout(() => this.sendPdf(pdfPath), 300);

    this.panel.onDidDispose(
      () => {
        PdfPreviewPanel.instance = undefined;
        this.dispose();
      },
      null,
      this.disposables
    );
  }

  /** Open or focus the preview panel, then display the given PDF. */
  static createOrShow(context: vscode.ExtensionContext, pdfPath: string): void {
    if (PdfPreviewPanel.instance) {
      PdfPreviewPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true);
      PdfPreviewPanel.instance.sendPdf(pdfPath);
      return;
    }
    PdfPreviewPanel.instance = new PdfPreviewPanel(context, pdfPath);
  }

  /** Refresh with a new PDF if the panel is already open. No-op otherwise. */
  static refresh(pdfPath: string): void {
    PdfPreviewPanel.instance?.sendPdf(pdfPath);
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private sendPdf(pdfPath: string): void {
    let data: string;
    try {
      data = fs.readFileSync(pdfPath).toString('base64');
    } catch {
      // PDF not yet flushed to disk – the next compile cycle will retry
      return;
    }
    this.panel.webview.postMessage({ command: 'renderPdf', data });
  }

  private buildHtml(): string {
    const webview = this.panel.webview;
    const nonce = randomNonce();
    const csp = webview.cspSource; // e.g. "vscode-webview-resource: https://*.vscode-cdn.net"

    const pdfjsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'pdf.min.js')
    );
    const previewJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src ${csp} 'nonce-${nonce}';
    style-src 'unsafe-inline';
    worker-src blob:;
    connect-src ${csp};
    img-src blob: data:;
  ">
  <title>LaTeX Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #404040;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 16px 0;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    #status {
      color: #bbb;
      font-size: 13px;
      padding: 8px 16px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
    }

    #status.hidden { display: none; }

    #pages {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 0 8px;
    }

    canvas {
      display: block;
      max-width: 100%;
      height: auto;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    }
  </style>
</head>
<body>
  <div id="status">Waiting for compilation…</div>
  <div id="pages"></div>

  <script nonce="${nonce}" src="${pdfjsUri}"></script>
  <script nonce="${nonce}" src="${previewJsUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

function randomNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
