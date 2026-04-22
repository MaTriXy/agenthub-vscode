import { CliAdapter } from '../types';
import { ClaudeAdapter } from './claude';
import { CodexAdapter } from './codex';
import { CursorAdapter } from './cursor';
import { GeminiAdapter } from './gemini';

export function createAdapters(): CliAdapter[] {
  return [new ClaudeAdapter(), new CodexAdapter(), new CursorAdapter(), new GeminiAdapter()];
}
