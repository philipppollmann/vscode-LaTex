import * as vscode from 'vscode';
import * as path from 'path';

export class LatexSidebarProvider implements vscode.TreeDataProvider<LatexNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<LatexNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LatexNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LatexNode): LatexNode[] {
    if (!element) {
      return [
        new SectionNode('settings', 'Settings'),
        new SectionNode('actions', 'Actions'),
      ];
    }

    if (element instanceof SectionNode) {
      switch (element.sectionId) {
        case 'settings': return this.getSettingsItems();
        case 'actions':  return this.getActionItems();
      }
    }

    return [];
  }

  private getSettingsItems(): LatexNode[] {
    const cfg = vscode.workspace.getConfiguration('latex');
    const mainFileSetting = cfg.get<string>('mainFile', '');
    const autoCompile = cfg.get<boolean>('autoCompile', true);

    const mainFileLabel = mainFileSetting
      ? path.basename(mainFileSetting)
      : 'Auto (active editor)';

    const mainFileTooltip = mainFileSetting
      ? new vscode.MarkdownString(`**Main file:** ${mainFileSetting}\n\nClick to change.`)
      : new vscode.MarkdownString('No main file set.\n\nClick to select one.');

    return [
      new ActionNode(
        `Main File: ${mainFileLabel}`,
        'latex.setMainFile',
        'file-text',
        mainFileTooltip,
        'mainFile'
      ),
      new ActionNode(
        `Auto-Compile: ${autoCompile ? 'On' : 'Off'}`,
        'latex.toggleAutoCompile',
        autoCompile ? 'check' : 'circle-slash',
        'Click to toggle automatic compilation on save.',
        'autoCompile'
      ),
    ];
  }

  private getActionItems(): LatexNode[] {
    return [
      new ActionNode('Compile', 'latex.compile', 'play', 'Compile the LaTeX project.', 'compile'),
      new ActionNode('Show Preview', 'latex.showPreview', 'open-preview', 'Show the PDF preview.', 'preview'),
    ];
  }
}

abstract class LatexNode extends vscode.TreeItem {}

class SectionNode extends LatexNode {
  constructor(
    public readonly sectionId: 'settings' | 'actions',
    label: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'section';
  }
}

class ActionNode extends LatexNode {
  constructor(
    label: string,
    commandId: string,
    icon: string,
    tooltip: string | vscode.MarkdownString,
    contextValue: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command: commandId, title: label };
    this.iconPath = new vscode.ThemeIcon(icon);
    this.tooltip = tooltip;
    this.contextValue = contextValue;
  }
}
