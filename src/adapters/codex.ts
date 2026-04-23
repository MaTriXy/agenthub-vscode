import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CliAdapter, CliSession, LaunchContext } from '../types';
import { which } from '../util/exec';
import { shellQuote } from '../util/shell';

export class CodexAdapter implements CliAdapter {
  id = 'codex';
  displayName = 'Codex CLI';
  capabilities = { canLaunchNew: true, canDiscoverSessions: true, canResumeSession: true };

  private cmd(): string {
    return vscode.workspace.getConfiguration('agentCommandCenter').get('codexCommand', 'codex');
  }

  async detectInstalled(): Promise<boolean> {
    return which(this.cmd());
  }

  async discoverSessions(): Promise<CliSession[]> {
    const base = path.join(os.homedir(), '.codex', 'sessions');
    if (!fs.existsSync(base)) return [];
    type Raw = { full: string; mtime: number };
    const raw: Raw[] = [];
    walk(base, (full) => {
      if (!full.endsWith('.jsonl') && !full.endsWith('.json')) return;
      try {
        const stat = fs.statSync(full);
        raw.push({ full, mtime: stat.mtimeMs });
      } catch { /* ignore */ }
    });
    raw.sort((a, b) => b.mtime - a.mtime);
    const top = raw.slice(0, 300);
    const sessions = await Promise.all(top.map(async (r) => {
      const meta = await withTimeoutCodex(readCodexMeta(r.full), 1200, {} as { cwd?: string; title?: string });
      return {
        adapterId: this.id,
        sessionId: r.full,
        title: meta.title ?? path.basename(r.full).replace(/\.(jsonl|json)$/, ''),
        workspacePath: meta.cwd,
        cwd: meta.cwd,
        updatedAt: r.mtime,
      } satisfies CliSession;
    }));
    return sessions;
  }

  buildNewCommand(_ctx: LaunchContext): string {
    return this.cmd();
  }

  buildResumeCommand(session: CliSession, _ctx: LaunchContext): string {
    return `${this.cmd()} resume ${shellQuote(session.sessionId)}`;
  }

  buildPromptCommand(prompt: string, _ctx: LaunchContext): string {
    return `${this.cmd()} ${shellQuote(prompt)}`;
  }
}

const HEAD_BYTES = 256 * 1024;

async function readCodexMeta(file: string): Promise<{ cwd?: string; title?: string }> {
  const meta: { cwd?: string; title?: string } = {};
  let fh: fs.promises.FileHandle | undefined;
  try {
    fh = await fs.promises.open(file, 'r');
    const { size } = await fh.stat();
    const len = Math.min(size, HEAD_BYTES);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, 0);
    const text = buf.toString('utf8');
    const lines = text.split('\n');
    if (size > HEAD_BYTES) lines.pop();
    for (const line of lines) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (!meta.cwd && typeof obj.cwd === 'string') meta.cwd = obj.cwd;
        if (!meta.cwd && typeof obj?.payload?.cwd === 'string') meta.cwd = obj.payload.cwd;
        if (!meta.title) {
          const t = extractText(obj);
          if (t) meta.title = t.length > 80 ? t.slice(0, 79) + '…' : t;
        }
      } catch { /* ignore */ }
      if (meta.cwd && meta.title) break;
    }
  } catch { /* ignore */ }
  finally { try { await fh?.close(); } catch { /* noop */ } }
  return meta;
}

function withTimeoutCodex<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(fallback); } }, ms);
    p.then((v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } })
     .catch(() => { if (!settled) { settled = true; clearTimeout(timer); resolve(fallback); } });
  });
}

function extractText(obj: any): string | undefined {
  // Codex rollouts: {type:"event_msg", payload:{type:"user_message", message:"..."}}
  if (obj?.type === 'event_msg' && obj?.payload?.type === 'user_message') {
    const m = obj.payload.message;
    if (typeof m === 'string') return clean(m);
  }
  // Codex rollouts: {type:"response_item", payload:{type:"message", role:"user", content:[{type:"input_text",text:"..."}]}}
  if (obj?.payload?.role === 'user' && Array.isArray(obj.payload.content)) {
    for (const p of obj.payload.content) {
      if (typeof p?.text === 'string') {
        const t = clean(p.text);
        if (t && !t.startsWith('<user_instructions>') && !t.startsWith('<environment_context>')) return t;
      }
    }
  }
  // Generic fallbacks
  const msg = obj?.message ?? obj;
  const role = msg?.role;
  if (role && role !== 'user') return undefined;
  const content = msg?.content;
  if (typeof content === 'string') return clean(content);
  if (Array.isArray(content)) {
    for (const p of content) {
      if (typeof p === 'string') { const t = clean(p); if (t) return t; }
      if (p && typeof p === 'object' && typeof p.text === 'string') {
        const t = clean(p.text);
        if (t) return t;
      }
    }
  }
  if (typeof msg?.text === 'string') return clean(msg.text);
  return undefined;
}

function clean(s: string): string | undefined {
  const t = s.replace(/\s+/g, ' ').trim();
  return t || undefined;
}

function walk(dir: string, onFile: (full: string) => void) {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}
