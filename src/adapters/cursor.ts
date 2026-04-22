import * as vscode from 'vscode';
import { CliAdapter, CliSession, LaunchContext } from '../types';
import { which } from '../util/exec';
import { shellQuote } from '../util/shell';

export class CursorAdapter implements CliAdapter {
  id = 'cursor';
  displayName = 'Cursor CLI';
  capabilities = { canLaunchNew: true, canDiscoverSessions: false, canResumeSession: false };

  private cmd(): string {
    return vscode.workspace.getConfiguration('agentCommandCenter').get('cursorCommand', 'cursor-agent');
  }

  async detectInstalled(): Promise<boolean> {
    return which(this.cmd());
  }

  async discoverSessions(): Promise<CliSession[]> {
    return [];
  }

  buildNewCommand(_ctx: LaunchContext): string {
    return this.cmd();
  }

  buildResumeCommand(_session: CliSession, _ctx: LaunchContext): string {
    return this.cmd();
  }

  buildPromptCommand(prompt: string, _ctx: LaunchContext): string {
    return `${this.cmd()} ${shellQuote(prompt)}`;
  }
}
