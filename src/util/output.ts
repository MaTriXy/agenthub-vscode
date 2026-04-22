import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function getChannel(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel('Agent Hub');
  return channel;
}

export function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  getChannel().appendLine(`[${ts}] ${msg}`);
}

export function showChannel(): void {
  getChannel().show(true);
}
