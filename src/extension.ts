import * as fs from 'fs';
import * as vscode from 'vscode';
import { createAdapters } from './adapters';
import { SessionIndex } from './sessions';
import { LayoutManager } from './layout/manager';
import { TerminalLauncher } from './terminals/launcher';
import { AgentHub, HubLauncherProvider } from './webview/hub';
import { SessionsProvider } from './tree/sessionsView';
import { log } from './util/output';
import { CliAdapter, CliSession, LaunchContext, LayoutPreset } from './types';

export async function activate(context: vscode.ExtensionContext) {
  const adapters = createAdapters();
  const index = new SessionIndex(adapters);
  const layout = new LayoutManager();
  const launcher = new TerminalLauncher();
  const installed = new Map<string, boolean>();

  const sessionsProvider = new SessionsProvider(adapters, index);
  // Keep a forward reference — refresh() is defined below; set the hook after creation.
  const launcherProvider = new HubLauncherProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('agentCommandCenter.launcher', launcherProvider),
    vscode.window.registerTreeDataProvider('agentCommandCenter.explorerSessions', sessionsProvider),
  );

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.text = '$(rocket) Agent Hub';
  statusItem.tooltip = 'Open Agent Command Center (⌘⌥A)';
  statusItem.command = 'agentCommandCenter.openHub';
  statusItem.show();
  context.subscriptions.push(statusItem);

  const refresh = async () => {
    await Promise.all(adapters.map(async (a) => installed.set(a.id, await a.detectInstalled())));
    await index.refresh();
    await sessionsProvider.refresh();
    sessionsProvider.notifyChanged();
    if (AgentHub.current) AgentHub.current.render(adapters, index, installed);
    const byAdapter = adapters.map((a) => `${a.id}=${index.get().filter((s) => s.adapterId === a.id).length}`).join(' ');
    log(`refresh complete: ${byAdapter}`);
  };
  sessionsProvider.setRefreshHook(refresh);

  const currentLayoutPreset = (): LayoutPreset =>
    vscode.workspace.getConfiguration('agentCommandCenter').get<LayoutPreset>('defaultLayoutPreset', 'two-columns');

  const safeCwd = (preferred?: string): string | undefined => {
    if (preferred && fs.existsSync(preferred)) return preferred;
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  };

  const launchContext = (): LaunchContext => {
    const cfg = vscode.workspace.getConfiguration('agentCommandCenter');
    return {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      layoutPreset: currentLayoutPreset(),
      openInEditorArea: cfg.get('useEditorAreaTerminals', true),
      focusTerminal: cfg.get('focusTerminalOnLaunch', true),
    };
  };

  const launchWithPrompt = async (adapter: CliAdapter, prompt: string) => {
    const ctx = launchContext();
    await layout.apply(ctx.layoutPreset);
    launcher.launch({
      name: `${adapter.displayName} — prompt`,
      cwd: safeCwd(ctx.cwd),
      command: adapter.buildPromptCommand(prompt, ctx),
      focus: ctx.focusTerminal,
      editorArea: ctx.openInEditorArea,
    });
  };

  const newSession = async (adapter: CliAdapter) => {
    const ctx = launchContext();
    await layout.apply(ctx.layoutPreset);
    launcher.launch({
      name: adapter.displayName,
      cwd: safeCwd(ctx.cwd),
      command: adapter.buildNewCommand(ctx),
      focus: ctx.focusTerminal,
      editorArea: ctx.openInEditorArea,
    });
  };

  const resume = async (session: CliSession) => {
    const adapter = adapters.find((a) => a.id === session.adapterId);
    if (!adapter) return;
    const ctx = launchContext();
    await layout.apply(ctx.layoutPreset);
    launcher.launch({
      name: `${adapter.displayName} (resume)`,
      cwd: safeCwd(session.cwd ?? ctx.cwd),
      command: adapter.buildResumeCommand(session, ctx),
      focus: ctx.focusTerminal,
      editorArea: ctx.openInEditorArea,
    });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('agentCommandCenter.openHub', async () => {
      await refresh();
      AgentHub.show(context, adapters, index, installed);
    }),
    vscode.commands.registerCommand('agentCommandCenter.refreshSessions', async () => {
      await refresh();
      const byAdapter = adapters
        .filter((a) => a.capabilities.canDiscoverSessions)
        .map((a) => `${a.displayName.replace(/ CLI$/, '')}: ${index.get().filter((s) => s.adapterId === a.id).length}`)
        .join(' · ');
      vscode.window.setStatusBarMessage(`Agent Hub — ${byAdapter}`, 4000);
    }),
    vscode.commands.registerCommand('agentCommandCenter.restoreLayout', () => layout.apply(currentLayoutPreset())),
    vscode.commands.registerCommand('agentCommandCenter.applyLayout', (preset: LayoutPreset) => layout.apply(preset)),
    vscode.commands.registerCommand('agentCommandCenter.layoutSingle', () => layout.apply('single-agent')),
    vscode.commands.registerCommand('agentCommandCenter.layoutTwoColumns', () => layout.apply('two-columns')),
    vscode.commands.registerCommand('agentCommandCenter.layoutGrid', () => layout.apply('grid')),
    vscode.commands.registerCommand('agentCommandCenter.layoutTerminalFocus', () => layout.apply('terminal-focus')),
    vscode.commands.registerCommand('agentCommandCenter.launchWithPrompt', async (adapterId: string, prompt: string) => {
      const adapter = adapters.find((a) => a.id === adapterId);
      if (!adapter) return;
      if (!installed.get(adapterId)) {
        vscode.window.showWarningMessage(`${adapter.displayName} is not installed.`);
        return;
      }
      if (!prompt || !prompt.trim()) return;
      await launchWithPrompt(adapter, prompt.trim());
    }),
    vscode.commands.registerCommand('agentCommandCenter.newClaude', () => newSession(findAdapter(adapters, 'claude'))),
    vscode.commands.registerCommand('agentCommandCenter.newCodex', () => newSession(findAdapter(adapters, 'codex'))),
    vscode.commands.registerCommand('agentCommandCenter.newCursor', () => newSession(findAdapter(adapters, 'cursor'))),
    vscode.commands.registerCommand('agentCommandCenter.newGemini', () => newSession(findAdapter(adapters, 'gemini'))),
    vscode.commands.registerCommand('agentCommandCenter.resumeSessionItem', (s: CliSession) => resume(s)),
    vscode.commands.registerCommand('agentCommandCenter.resumeSession', async () => {
      const sessions = index.get();
      if (sessions.length === 0) {
        vscode.window.showInformationMessage('No sessions found. Try Refresh.');
        return;
      }
      const pick = await vscode.window.showQuickPick(
        sessions.map((s) => ({
          label: s.title || s.sessionId,
          description: s.adapterId,
          detail: s.updatedAt ? new Date(s.updatedAt).toLocaleString() : undefined,
          session: s,
        })),
        { placeHolder: 'Select a session to resume' },
      );
      if (pick) await resume(pick.session);
    }),
    vscode.commands.registerCommand('agentCommandCenter.resumeLast', async () => {
      const last = index.get()[0];
      if (!last) {
        vscode.window.showInformationMessage('No sessions discovered yet.');
        return;
      }
      await resume(last);
    }),
    vscode.commands.registerCommand('agentCommandCenter.scanInstalled', async () => {
      await refresh();
      const lines = adapters.map((a) => `${a.displayName}: ${installed.get(a.id) ? 'installed' : 'not found'}`);
      vscode.window.showInformationMessage(lines.join(' · '));
    }),
  );

  await refresh();
}

export function deactivate() {}

function findAdapter(adapters: CliAdapter[], id: string): CliAdapter {
  const a = adapters.find((x) => x.id === id);
  if (!a) throw new Error(`Adapter not found: ${id}`);
  return a;
}
