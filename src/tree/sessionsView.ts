import * as vscode from 'vscode';
import { CliAdapter, CliSession } from '../types';
import { SessionIndex } from '../sessions';

type Node = AdapterNode | SessionNode | EmptyNode;

class AdapterNode extends vscode.TreeItem {
  constructor(public adapter: CliAdapter, public installed: boolean, count: number) {
    super(adapter.displayName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = installed ? `${count} session${count === 1 ? '' : 's'}` : 'not installed';
    this.iconPath = new vscode.ThemeIcon(installed ? 'rocket' : 'circle-slash');
    this.contextValue = `adapter-${adapter.id}`;
  }
}

class SessionNode extends vscode.TreeItem {
  constructor(public session: CliSession) {
    super(session.title || session.sessionId, vscode.TreeItemCollapsibleState.None);
    this.description = session.updatedAt ? relativeTime(session.updatedAt) : '';
    this.tooltip = [
      `${session.adapterId}: ${session.sessionId}`,
      session.workspacePath ?? '',
      session.updatedAt ? new Date(session.updatedAt).toLocaleString() : '',
    ].filter(Boolean).join('\n');
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
    this.contextValue = 'session';
    this.command = {
      command: 'agentCommandCenter.resumeSessionItem',
      title: 'Resume',
      arguments: [session],
    };
  }
}

class EmptyNode extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export class SessionsProvider implements vscode.TreeDataProvider<Node> {
  private emitter = new vscode.EventEmitter<Node | undefined | void>();
  onDidChangeTreeData = this.emitter.event;

  private installed = new Map<string, boolean>();
  private onRefreshRequested?: () => Promise<void>;
  private lastAutoRefresh = 0;

  constructor(private adapters: CliAdapter[], private index: SessionIndex) {}

  setRefreshHook(fn: () => Promise<void>) { this.onRefreshRequested = fn; }

  async refresh() {
    await Promise.all(
      this.adapters.map(async (a) => {
        this.installed.set(a.id, await a.detectInstalled());
      }),
    );
    this.emitter.fire();
  }

  notifyChanged() {
    this.emitter.fire();
  }

  getTreeItem(el: Node): vscode.TreeItem {
    return el;
  }

  getChildren(el?: Node): Node[] {
    if (!el) {
      // Debounced auto-refresh on root query so newest session always shows.
      const now = Date.now();
      if (this.onRefreshRequested && now - this.lastAutoRefresh > 5000) {
        this.lastAutoRefresh = now;
        void this.onRefreshRequested();
      }
      return this.adapters.map((a) => {
        const count = this.index.get().filter((s) => s.adapterId === a.id).length;
        return new AdapterNode(a, this.installed.get(a.id) ?? false, count);
      });
    }
    if (el instanceof AdapterNode) {
      const sessions = this.index.get().filter((s) => s.adapterId === el.adapter.id);
      if (sessions.length === 0) {
        if (!el.installed) return [new EmptyNode('CLI not detected')];
        if (!el.adapter.capabilities.canDiscoverSessions) return [new EmptyNode('Session discovery not supported')];
        return [new EmptyNode('No sessions yet')];
      }
      return sessions.map((s) => new SessionNode(s));
    }
    return [];
  }
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = 60_000, h = 3_600_000, d = 86_400_000;
  if (diff < m) return 'just now';
  if (diff < h) return `${Math.floor(diff / m)}m ago`;
  if (diff < d) return `${Math.floor(diff / h)}h ago`;
  if (diff < 7 * d) return `${Math.floor(diff / d)}d ago`;
  return new Date(ms).toLocaleDateString();
}
