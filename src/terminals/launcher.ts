import * as vscode from 'vscode';

export interface LaunchOptions {
  name: string;
  cwd?: string;
  command: string;
  focus?: boolean;
  editorArea?: boolean;
}

export class TerminalLauncher {
  launch(opts: LaunchOptions): vscode.Terminal {
    const termOpts: vscode.TerminalOptions = {
      name: opts.name,
      cwd: opts.cwd,
    };
    if (opts.editorArea) {
      (termOpts as any).location = { viewColumn: vscode.ViewColumn.Beside };
    }
    const term = vscode.window.createTerminal(termOpts);
    term.show(!opts.focus);
    // Give the shell a moment to print its prompt before sending the command,
    // otherwise rapid launches can interleave input and produce stacked invocations.
    setTimeout(() => term.sendText(opts.command, true), 300);
    return term;
  }
}
