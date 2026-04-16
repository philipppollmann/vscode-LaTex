// Copies the PDF.js UMD build files from node_modules into media/
// so they can be served to the webview via localResourceRoots.
// Runs automatically after `npm install` (postinstall hook).
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build');
const destDir = path.join(__dirname, '..', 'media');

if (!fs.existsSync(srcDir)) {
  console.log('[copy-pdfjs] pdfjs-dist not installed yet, skipping.');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });

const files = ['pdf.min.js', 'pdf.worker.min.js'];
for (const file of files) {
  const from = path.join(srcDir, file);
  const to = path.join(destDir, file);
  if (!fs.existsSync(from)) {
    console.error(`[copy-pdfjs] File not found: ${from}`);
    process.exit(1);
  }
  fs.copyFileSync(from, to);
  console.log(`[copy-pdfjs] ${file} → media/`);
}
