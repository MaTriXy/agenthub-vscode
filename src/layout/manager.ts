import * as vscode from 'vscode';
import { LayoutPreset } from '../types';

export class LayoutManager {
  async apply(preset: LayoutPreset): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('agentCommandCenter');
    const keepExplorer = cfg.get('keepExplorerVisible', true);

    if (keepExplorer) {
      await vscode.commands.executeCommand('workbench.view.explorer');
    }

    switch (preset) {
      case 'single-agent':
        await this.singleAgent();
        break;
      case 'two-columns':
        await this.twoColumns();
        break;
      case 'grid':
        await this.grid();
        break;
      case 'terminal-focus':
        await this.terminalFocus();
        break;
    }
  }

  private async singleAgent() {
    await vscode.commands.executeCommand('workbench.action.editorLayoutSingle');
    await vscode.commands.executeCommand('workbench.action.terminal.focus');
  }

  private async twoColumns() {
    await vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');
    await vscode.commands.executeCommand('workbench.action.terminal.focus');
  }

  private async grid() {
    await vscode.commands.executeCommand('workbench.action.editorLayoutTwoByTwoGrid');
    await vscode.commands.executeCommand('workbench.action.terminal.focus');
  }

  private async terminalFocus() {
    await vscode.commands.executeCommand('workbench.action.editorLayoutSingle');
    await vscode.commands.executeCommand('workbench.action.terminal.focus');
    await vscode.commands.executeCommand('workbench.action.toggleMaximizedPanel');
  }
}
