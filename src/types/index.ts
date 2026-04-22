export type LayoutPreset = 'single-agent' | 'two-columns' | 'grid' | 'terminal-focus';

export interface CliSession {
  adapterId: string;
  sessionId: string;
  title: string;
  workspacePath?: string;
  cwd?: string;
  updatedAt?: number;
}

export interface LaunchContext {
  cwd?: string;
  layoutPreset: LayoutPreset;
  openInEditorArea?: boolean;
  focusTerminal?: boolean;
}

export interface CliCapabilities {
  canLaunchNew: boolean;
  canDiscoverSessions: boolean;
  canResumeSession: boolean;
}

export interface CliAdapter {
  id: string;
  displayName: string;
  capabilities: CliCapabilities;
  detectInstalled(): Promise<boolean>;
  discoverSessions(): Promise<CliSession[]>;
  buildNewCommand(context: LaunchContext): string;
  buildResumeCommand(session: CliSession, context: LaunchContext): string;
  buildPromptCommand(prompt: string, context: LaunchContext): string;
}
