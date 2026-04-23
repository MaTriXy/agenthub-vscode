import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CliAdapter, CliSession, LaunchContext } from '../types';
import { which } from '../util/exec';
import { shellQuote } from '../util/shell';

export class ClaudeAdapter implements CliAdapter {
  id = 'claude';
  displayName = 'Claude CLI';
  capabilities = { canLaunchNew: true, canDiscoverSessions: true, canResumeSession: true };

  private cmd(): string {
    return vscode.workspace.getConfiguration('agentCommandCenter').get('claudeCommand', 'claude');
  }

  async detectInstalled(): Promise<boolean> {
    return which(this.cmd());
  }

  async discoverSessions(): Promise<CliSession[]> {
    const base = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(base)) return [];
    type Raw = { projectDir: string; file: string; full: string; mtime: number };
    const raw: Raw[] = [];
    for (const projectDir of safeReadDir(base)) {
      const fullProject = path.join(base, projectDir);
      try { if (!fs.statSync(fullProject).isDirectory()) continue; } catch { continue; }
      for (const file of safeReadDir(fullProject)) {
        if (!file.endsWith('.jsonl')) continue;
        const full = path.join(fullProject, file);
        try {
          const stat = fs.statSync(full);
          raw.push({ projectDir, file, full, mtime: stat.mtimeMs });
        } catch { /* ignore */ }
      }
    }
    raw.sort((a, b) => b.mtime - a.mtime);
    const top = raw.slice(0, 300);
    const sessions = await Promise.all(top.map(async (r) => {
      const meta = await withTimeout(readSessionMeta(r.full), 1200, {} as SessionMeta);
      const realCwd = meta.cwd ?? resolveProjectDir(r.projectDir);
      const fallbackTitle = realCwd ? path.basename(realCwd) : r.file.replace(/\.jsonl$/, '');
      return {
        adapterId: this.id,
        sessionId: r.file.replace(/\.jsonl$/, ''),
        title: meta.title ?? fallbackTitle,
        workspacePath: realCwd,
        cwd: realCwd,
        updatedAt: r.mtime,
      } satisfies CliSession;
    }));
    return sessions;
  }

  buildNewCommand(_ctx: LaunchContext): string {
    return this.cmd();
  }

  buildResumeCommand(session: CliSession, _ctx: LaunchContext): string {
    return `${this.cmd()} --resume ${shellQuote(session.sessionId)}`;
  }

  buildPromptCommand(prompt: string, _ctx: LaunchContext): string {
    return `${this.cmd()} ${shellQuote(prompt)}`;
  }
}

function safeReadDir(p: string): string[] {
  try { return fs.readdirSync(p); } catch { return []; }
}

function resolveProjectDir(name: string): string | undefined {
  // Claude encodes paths by replacing both `/` and `.` with `-`, making it ambiguous.
  // Try the naive decode first; if it doesn't exist, walk dash positions and try `.`.
  if (!name.startsWith('-')) return name;
  const positions: number[] = [];
  for (let i = 0; i < name.length; i++) if (name[i] === '-') positions.push(i);
  const naive = '/' + name.slice(1).replace(/-/g, '/');
  if (fs.existsSync(naive)) return naive;
  // Try each dash as a dot (common when usernames or hostnames contain dots).
  for (const pos of positions) {
    const chars = name.split('');
    chars[pos] = '.';
    const candidate = '/' + chars.slice(1).join('').replace(/-/g, '/');
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

interface SessionMeta { cwd?: string; title?: string; }

const HEAD_BYTES = 256 * 1024; // read just the first 256 KB; plenty for first few turns.

async function readSessionMeta(file: string): Promise<SessionMeta> {
  let fh: fs.promises.FileHandle | undefined;
  const meta: SessionMeta = {};
  try {
    fh = await fs.promises.open(file, 'r');
    const { size } = await fh.stat();
    const len = Math.min(size, HEAD_BYTES);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, 0);
    const text = buf.toString('utf8');
    const lines = text.split('\n');
    // If we read the head only, the last line is probably partial — drop it.
    if (size > HEAD_BYTES) lines.pop();
    for (const line of lines) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (!meta.cwd && typeof obj.cwd === 'string') meta.cwd = obj.cwd;
        if (!meta.title) {
          const t = extractUserText(obj);
          if (t) meta.title = truncate(t, 80);
        }
      } catch { /* malformed or partial JSON line */ }
      if (meta.cwd && meta.title) break;
    }
  } catch {
    /* ignore read errors, return whatever we have */
  } finally {
    try { await fh?.close(); } catch { /* noop */ }
  }
  return meta;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(fallback); } }, ms);
    p.then((v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } })
     .catch(() => { if (!settled) { settled = true; clearTimeout(timer); resolve(fallback); } });
  });
}

function extractUserText(obj: any): string | undefined {
  // Claude jsonl user turns can be: { type: "user", message: { content: [ { type:"text", text:"..." } ] } }
  // or: { role:"user", content:"..." } depending on version. Try several shapes.
  const msg = obj?.message ?? obj;
  const role = obj?.type ?? msg?.role;
  if (role !== 'user' && role !== undefined) return undefined;
  const content = msg?.content;
  if (typeof content === 'string') return content.trim() || undefined;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === 'string') { const t = part.trim(); if (t) return t; }
      if (part && typeof part === 'object') {
        if (part.type === 'text' && typeof part.text === 'string') {
          const t = part.text.trim();
          if (t && !t.startsWith('<command-')) return t;
        }
      }
    }
  }
  if (typeof msg?.text === 'string') return msg.text.trim() || undefined;
  return undefined;
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}
