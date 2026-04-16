// Webview-side script for the LaTeX PDF preview panel.
// Runs in the browser context of the VS Code webview (not Node.js).
// pdf.min.js (pdfjs-dist UMD) is loaded before this script via a <script> tag.
(function () {
  'use strict';

  const pdfjsLib = globalThis.pdfjsLib;
  const statusEl = document.getElementById('status');
  const pagesEl = document.getElementById('pages');

  // ── Worker setup ──────────────────────────────────────────────────────────
  // PDF.js needs a Web Worker. VS Code's CSP allows `worker-src blob:` but not
  // vscode-webview-resource: as a worker source directly.
  // Solution: fetch the worker script from its webview URI, create a Blob URL,
  // and point PDF.js at the Blob URL. connect-src in the CSP allows the fetch.
  const workerReady = (async () => {
    // Derive the worker URL from the pdf.min.js <script> tag URL
    const scripts = document.querySelectorAll('script[src]');
    let workerUrl;
    for (const s of scripts) {
      if (s.src.includes('pdf.min.js')) {
        workerUrl = s.src.replace('pdf.min.js', 'pdf.worker.min.js');
        break;
      }
    }
    if (!workerUrl) {
      throw new Error('[LaTeX Preview] Cannot locate pdf.worker.min.js URL');
    }
    const resp = await fetch(workerUrl);
    const blob = await resp.blob();
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  })();

  // ── Message handler ───────────────────────────────────────────────────────
  window.addEventListener('message', async (event) => {
    const { command, data } = event.data;
    if (command !== 'renderPdf') { return; }

    statusEl.textContent = 'Rendering…';
    statusEl.classList.remove('hidden');

    try {
      await workerReady;
    } catch (e) {
      statusEl.textContent = 'Worker error: ' + e.message;
      return;
    }

    // Decode base64 → Uint8Array
    let bytes;
    try {
      const bin = atob(data);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
    } catch (e) {
      statusEl.textContent = 'Decode error: ' + e.message;
      return;
    }

    // Load PDF document
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    } catch (e) {
      statusEl.textContent = 'PDF error: ' + e.message;
      return;
    }

    // Render all pages
    pagesEl.innerHTML = '';

    const scale = 1.5; // ~108 DPI on a standard display

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      // CSS constrains width so the canvas stays within the panel
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';

      pagesEl.appendChild(canvas);

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      }).promise;
    }

    statusEl.textContent = `${pdf.numPages} page${pdf.numPages !== 1 ? 's' : ''}`;
    statusEl.classList.add('hidden');
  });
})();
