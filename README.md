# LaTeX Live Preview – VS Code Extension

A VS Code extension that brings the **Overleaf experience** to your local machine: live PDF preview beside the editor, automatic compilation on save, and easy main-file selection.

---

## Prerequisites

Before installing the extension, make sure the following are available on your system.

### 1. A LaTeX distribution

You need a full LaTeX installation that includes `latexmk` and `pdflatex`.

| OS | Recommended distribution |
|----|--------------------------|
| macOS | [MacTeX](https://www.tug.org/mactex/) |
| Windows | [MiKTeX](https://miktex.org/) or [TeX Live](https://www.tug.org/texlive/) |
| Linux | TeX Live via your package manager (`sudo apt install texlive-full`) |

Verify the installation by running in a terminal:
```bash
latexmk --version
pdflatex --version
```

### 2. Node.js and npm

Required to install the extension's JavaScript dependencies (PDF.js).

Download from [nodejs.org](https://nodejs.org) (LTS version recommended).

### 3. VS Code

Version **1.85.0 or newer**. Download from [code.visualstudio.com](https://code.visualstudio.com).

---

## Installation via VSIX (Recommended)

Building a `.vsix` package lets you install the extension permanently into any VS Code instance – no need to keep a terminal open or press F5 every time.

### Step 1 – Install the VS Code Extension CLI (`vsce`)

```bash
npm install -g @vscode/vsce
```

### Step 2 – Clone and install dependencies

```bash
git clone https://github.com/your-username/vscode-LaTex.git
cd vscode-LaTex
npm install
```

### Step 3 – Build the `.vsix` package

```bash
vsce package
```

This compiles the TypeScript, copies all required files, and produces a file named `vscode-latex-0.1.0.vsix` in the project root.

### Step 4 – Install the package in VS Code

**Option A – via the terminal:**
```bash
code --install-extension vscode-latex-0.1.0.vsix
```

**Option B – via the VS Code UI:**

1. Open the Extensions sidebar (`Cmd+Shift+X` / `Ctrl+Shift+X`)
2. Click the **`···`** menu (top-right of the sidebar)
3. Select **Install from VSIX…**
4. Choose the `.vsix` file

Restart VS Code after installation. The extension activates automatically whenever you open a `.tex` file.

### Updating

To install a newer version, rebuild the `.vsix` with `vsce package` and install it again with `code --install-extension`. VS Code replaces the old version automatically.

---

## Installation (Development Mode)

Only needed if you want to modify the extension source code. For regular use, prefer the VSIX method above.

**Step 1 – Clone the repository**
```bash
git clone https://github.com/your-username/vscode-LaTex.git
cd vscode-LaTex
```

**Step 2 – Install dependencies**
```bash
npm install
```

This also automatically copies the required PDF.js files into the `media/` folder (via a `postinstall` script).

**Step 3 – Open the folder in VS Code**
```bash
code .
```

**Step 4 – Launch the Extension Development Host**

Press **F5** (or go to *Run → Start Debugging*).

A new VS Code window opens with the extension active. Use that window to open your LaTeX project.

---

## Usage

### Open a LaTeX project

Open the folder that contains your `.tex` files (*File → Open Folder…*).

### Set the main file (optional)

If your project has multiple `.tex` files, tell the extension which one is the root document:

1. Open the Command Palette: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)
2. Run **LaTeX: Set Main File**
3. Select your root `.tex` file from the list

The choice is saved in the workspace settings and restored the next time you open the project.

If you skip this step, the extension compiles whichever `.tex` file is currently active in the editor.

### Compile and open the preview

| Action | Shortcut | Command Palette |
|--------|----------|-----------------|
| Compile | `Cmd+Alt+B` / `Ctrl+Alt+B` | **LaTeX: Compile** |
| Open PDF preview | `Cmd+Alt+P` / `Ctrl+Alt+P` | **LaTeX: Show PDF Preview** |

The PDF panel opens **beside the editor**, just like Overleaf's split view.

### Auto-compile on save

Every time you save a `.tex` or `.bib` file the extension compiles automatically and refreshes the preview. No shortcut needed – just write and save.

To disable auto-compile, add this to your VS Code settings (`Cmd+,`):
```json
"latex.autoCompile": false
```

### Status bar

The bottom status bar shows the current compilation state:

| Icon | Meaning |
|------|---------|
| `$(file-pdf) LaTeX` | Idle – click to compile manually |
| `$(loading~spin) LaTeX: Compiling…` | Compilation in progress |
| `$(check) LaTeX: Done` | Last compilation succeeded |
| `$(error) LaTeX: Error` | Compilation failed – see output |

Click the status bar item at any time to trigger a manual compile.

### Compilation output

If something goes wrong, the **LaTeX Compiler** output channel shows the full `latexmk` log. It opens automatically on error, or you can open it manually:

*View → Output → LaTeX Compiler*

---

## Settings

All settings are under the `latex.*` namespace and can be configured in your workspace or user settings (`Cmd+,`).

| Setting | Default | Description |
|---------|---------|-------------|
| `latex.mainFile` | `""` | Relative path to the root `.tex` file. Set via the command or manually. |
| `latex.outputDir` | `"out"` | Directory for compiled output (PDF, aux files), relative to the workspace root. |
| `latex.latexmkPath` | `"/Library/TeX/texbin/latexmk"` | Absolute path to the `latexmk` binary. Change this if your TeX installation is in a different location. |
| `latex.extraArgs` | `[]` | Additional arguments passed to `latexmk`, e.g. `["-shell-escape"]` for packages like `minted`. |
| `latex.autoCompile` | `true` | Compile automatically whenever a `.tex` or `.bib` file is saved. |

**Example – Windows with MiKTeX:**
```json
"latex.latexmkPath": "C:\\Users\\you\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\latexmk.exe",
"latex.outputDir": "out"
```

**Example – enable shell-escape (for `minted` package):**
```json
"latex.extraArgs": ["-shell-escape"]
```

---

## How it works

1. **Compilation** – `latexmk -pdf` is called with the configured main file. Output goes into `<workspace>/out/` by default, keeping your source folder clean.
2. **PDF rendering** – The compiled PDF is read and displayed inside a VS Code WebviewPanel using [PDF.js](https://mozilla.github.io/pdf.js/). No external PDF viewer is needed.
3. **Live refresh** – After every successful compile the preview panel updates automatically.
4. **Rapid saves** – If you save again while a compile is still running, the previous compile is cancelled and a fresh one starts, so the preview always reflects the latest state.

---

## Troubleshooting

**"Cannot start latexmk"**
The `latexmk` binary was not found. Check the `latex.latexmkPath` setting and make sure your LaTeX distribution is installed correctly.

**Preview stays blank after compile**
Check the *LaTeX Compiler* output channel for errors. Common causes are missing packages or a syntax error in the `.tex` file.

**Compilation succeeds but no PDF appears**
The PDF is written to the `out/` folder inside your workspace. Make sure the `latex.outputDir` setting matches and that VS Code has write permission to that directory.

**macOS: latexmk not found even though MacTeX is installed**
MacTeX installs to `/Library/TeX/texbin/`. The extension adds this to `PATH` automatically, but if you have a custom TeX installation set `latex.latexmkPath` to the correct absolute path.
