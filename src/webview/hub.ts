import * as vscode from 'vscode';
import { CliAdapter, CliSession } from '../types';
import { SessionIndex } from '../sessions';

const SHORTCUTS: Record<string, string> = {
  claude: '⌘⌥C',
  codex: '⌘⌥X',
  cursor: '⌘⌥U',
  gemini: '⌘⌥G',
  resumeLast: '⌘⌥R',
  resumeSession: '⌘⌥⇧R',
  refresh: '⌘⌥⇧F',
  openHub: '⌘⌥A',
  layoutSingle: '⌘⌥1',
  layoutTwoColumns: '⌘⌥2',
  layoutGrid: '⌘⌥3',
  layoutTerminalFocus: '⌘⌥4',
  restoreLayout: '⌘⌥0',
};

export class AgentHub {
  static current: AgentHub | undefined;
  private panel: vscode.WebviewPanel;

  static show(
    ctx: vscode.ExtensionContext,
    adapters: CliAdapter[],
    index: SessionIndex,
    installed: Map<string, boolean>,
  ) {
    if (AgentHub.current) {
      AgentHub.current.panel.reveal(vscode.ViewColumn.Active);
      AgentHub.current.render(adapters, index, installed);
      return AgentHub.current;
    }
    const panel = vscode.window.createWebviewPanel(
      'agentHub.hub',
      'Agent Hub',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [ctx.extensionUri],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, 'logo.png');
    const hub = new AgentHub(panel, ctx.extensionUri);
    AgentHub.current = hub;
    panel.onDidDispose(() => (AgentHub.current = undefined));
    panel.webview.onDidReceiveMessage(
      (msg) => handleMessage(msg),
      undefined,
      ctx.subscriptions,
    );
    hub.render(adapters, index, installed);
    return hub;
  }

  private constructor(panel: vscode.WebviewPanel, private extensionUri: vscode.Uri) {
    this.panel = panel;
  }

  render(adapters: CliAdapter[], index: SessionIndex, installed: Map<string, boolean>) {
    const logoUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'logo.png'),
    );
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.panel.webview.html = renderHtml(adapters, installed, index.get(), logoUri.toString(), cwd);
  }
}

export function handleMessage(msg: any) {
  if (!msg || typeof msg.type !== 'string') return;
  switch (msg.type) {
    case 'newSession':
      vscode.commands.executeCommand(`agentCommandCenter.new${cap(msg.adapterId)}`);
      break;
    case 'resume':
      vscode.commands.executeCommand('agentCommandCenter.resumeSessionItem', msg.session);
      break;
    case 'refresh':
      vscode.commands.executeCommand('agentCommandCenter.refreshSessions');
      break;
    case 'resumeLast':
      vscode.commands.executeCommand('agentCommandCenter.resumeLast');
      break;
    case 'layout':
      vscode.commands.executeCommand(`agentCommandCenter.layout${cap(msg.preset)}`);
      break;
    case 'restoreLayout':
      vscode.commands.executeCommand('agentCommandCenter.restoreLayout');
      break;
    case 'launchPrompt':
      vscode.commands.executeCommand('agentCommandCenter.launchWithPrompt', msg.adapterId, msg.prompt);
      break;
  }
}

function cap(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function renderHtml(
  adapters: CliAdapter[],
  installed: Map<string, boolean>,
  sessions: CliSession[],
  logoUri?: string,
  workspacePath?: string,
): string {
  const installedAdapters = adapters.filter((a) => installed.get(a.id));
  const iconFor = (id: string) => ({ claude: '✦', codex: '◆', cursor: '▸', gemini: '★' }[id] || '●');

  const startButtons = installedAdapters.map((a, i) => `
    ${i > 0 ? '<span class="start-sep">·</span>' : ''}
    <a class="start-link" href="#" onclick="post({type:'newSession', adapterId:'${a.id}'});return false;">
      <span class="start-icon">${iconFor(a.id)}</span>
      <span class="start-name">${esc(a.displayName.replace(/ CLI$/, ''))}</span>
      <span class="kbd kbd-xl">${SHORTCUTS[a.id] ?? ''}</span>
    </a>
  `).join('');

  const emptyStart = installedAdapters.length === 0
    ? `<p class="muted">No supported CLIs detected. Install one of: ${adapters.map(a => esc(a.displayName)).join(', ')}.</p>`
    : '';

  const recentList = sessions.slice(0, 10).map((s) => {
    const title = s.title || s.sessionId;
    const folder = s.workspacePath ? basename(s.workspacePath) : '';
    const when = s.updatedAt ? relative(s.updatedAt) : '';
    return `
    <a class="recent" href="#" onclick='post({type:"resume", session:${JSON.stringify(s).replace(/'/g, "&#39;")}});return false;' title="${esc(s.workspacePath ?? '')}\n${esc(s.sessionId)}">
      <span class="recent-icon">${iconFor(s.adapterId)}</span>
      <span class="recent-title">${esc(title)}</span>
      <span class="recent-meta">${esc(s.adapterId)}${folder ? ' · ' + esc(folder) : ''} · ${esc(when)}</span>
    </a>`;
  }).join('');

  const layoutTiles = [
    { id: 'Single',         label: 'Single',         svg: tileSingle,      kbd: SHORTCUTS.layoutSingle },
    { id: 'TwoColumns',     label: 'Two Columns',    svg: tileTwoCols,     kbd: SHORTCUTS.layoutTwoColumns },
    { id: 'Grid',           label: 'Grid',           svg: tileGrid,        kbd: SHORTCUTS.layoutGrid },
    { id: 'TerminalFocus',  label: 'Terminal Focus', svg: tileTerm,        kbd: SHORTCUTS.layoutTerminalFocus },
  ].map((t) => `
    <a class="tile" href="#" onclick="post({type:'layout', preset:'${t.id}'});return false;">
      <div class="tile-art">${t.svg}</div>
      <div class="tile-foot">
        <span class="tile-name">${t.label}</span>
        <span class="kbd kbd-xl">${t.kbd}</span>
      </div>
    </a>
  `).join('');

  const nonce = Math.random().toString(36).slice(2);
  const csp = [
    `default-src 'none'`,
    `img-src 'self' https: data:`,
    `style-src 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src 'self' data:`,
  ].join('; ');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
  :root { color-scheme: dark light; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
  }
  .page { max-width: 1040px; margin: 0 auto; padding: 56px 48px 72px; }

  /* Centered hero */
  .hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; margin-bottom: 28px; }
  .ascii {
    font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, 'Cascadia Mono', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 12px; line-height: 1.1;
    color: var(--vscode-textLink-foreground);
    margin: 0; padding: 0;
    white-space: pre; overflow-x: auto; max-width: 100%;
    font-variant-ligatures: none;
    font-feature-settings: "liga" 0, "calt" 0;
    letter-spacing: 0;
    tab-size: 4;
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: 36px; font-weight: 300; margin: 0; letter-spacing: -0.5px; }
  .tagline { font-size: 15px; opacity: 0.7; margin: 0; }

  h2 { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7; margin: 36px 0 14px; }

  .muted { opacity: 0.65; font-size: 13px; text-align: center; }

  /* Start row — single line of plain text links */
  .start-row {
    display: flex; gap: 14px; align-items: center; justify-content: center;
    flex-wrap: wrap; margin: 22px 0 8px;
  }
  .start-link {
    display: inline-flex; align-items: center; gap: 8px;
    color: var(--vscode-foreground); text-decoration: none;
    padding: 4px 2px; font-size: 15px;
  }
  .start-link:hover { color: var(--vscode-textLink-activeForeground); }
  .start-link .start-icon { font-size: 16px; opacity: 0.85; }
  .start-link .start-name { font-weight: 500; }
  .start-sep { opacity: 0.35; font-size: 14px; }

  /* Two-column section for Recent + Layouts */
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  @media (max-width: 780px) { .columns { grid-template-columns: 1fr; } }

  .recent {
    display: grid; grid-template-columns: 18px 1fr auto; gap: 4px 12px;
    padding: 8px 10px; border-radius: 4px; text-decoration: none;
    color: var(--vscode-foreground); align-items: center;
  }
  .recent:hover { background: var(--vscode-list-hoverBackground); }
  .recent-icon { opacity: 0.7; }
  .recent-title { color: var(--vscode-textLink-foreground); font-size: 13px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .recent-meta { font-size: 11px; opacity: 0.55; grid-column: 2 / -1; }

  /* Layout tiles — smaller imagery, big shortcut badge */
  .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .tile {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border: 1px solid var(--vscode-panel-border);
    border-radius: 6px; text-decoration: none; color: var(--vscode-foreground);
    background: var(--vscode-editorWidget-background);
  }
  .tile:hover { border-color: var(--vscode-focusBorder); }
  .tile-art { width: 44px; aspect-ratio: 16/10; flex: none; opacity: 0.75; }
  .tile-art svg { width: 100%; height: 100%; }
  .tile-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: 1; }
  .tile-name { font-size: 13px; }

  /* Shortcut badges */
  .kbd {
    font-family: var(--vscode-editor-font-family, monospace);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px; padding: 3px 8px; font-size: 12px; opacity: 0.9;
    background: var(--vscode-editorWidget-background);
    white-space: nowrap;
  }
  .kbd-lg { font-size: 14px; padding: 4px 10px; letter-spacing: 0.5px; }
  .kbd-xl {
    font-size: 16px; font-weight: 600; padding: 5px 12px; letter-spacing: 0.5px;
    background: var(--vscode-editor-background);
    border-color: var(--vscode-focusBorder);
    opacity: 1;
  }

  .cwd-note {
    margin: 8px auto 0; max-width: 720px;
    font-size: 11px; opacity: 0.55;
    display: flex; align-items: center; gap: 6px;
    font-family: var(--vscode-editor-font-family, monospace);
  }

  /* Prompt box — centered under hero */
  .prompt-box {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 12px;
    background: var(--vscode-editorWidget-background);
    padding: 14px 16px;
    margin: 0 auto;
    max-width: 720px;
  }
  .prompt-box textarea {
    width: 100%;
    background: transparent;
    color: var(--vscode-foreground);
    border: none;
    resize: vertical;
    font-family: var(--vscode-font-family);
    font-size: 14px;
    outline: none;
    padding: 4px 0 10px;
  }
  .prompt-row { display: flex; gap: 10px; align-items: center; }
  .prompt-row select {
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: 6px 10px; border-radius: 4px; font-size: 13px;
  }
  .prompt-row button {
    margin-left: auto;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; padding: 6px 14px; border-radius: 4px; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .prompt-row button:hover { background: var(--vscode-button-hoverBackground); }
  .prompt-row button .kbd { opacity: 0.8; border-color: transparent;
    background: rgba(255,255,255,0.12); }

  .footer-actions { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .footer-actions a {
    color: var(--vscode-textLink-foreground); text-decoration: none; font-size: 13px;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .footer-actions a:hover { color: var(--vscode-textLink-activeForeground); }
</style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <pre class="ascii" aria-label="Agent Hub">     _     _____                       _       _   _         _                __  _
   /' )   (  _  )                     ( )_    ( ) ( )       ( )              /  )( \`\\
 /' /'    | (_) |   __     __    ___  | ,_)   | |_| | _   _ | |_           /' /'  \`\\ \`\\
&lt;  &lt;      |  _  | /'_ \`\\ /'__\`\\/' _ \`\\| |     |  _  |( ) ( )| '_\`\\       /' /'      &gt;  &gt;
 \\  \`\\    | | | |( (_) |(  ___/| ( ) || |_    | | | || (_) || |_) )    /' /'      /' /'
  \`\\__)   (_) (_)\`\\__  |\`\\____)(_) (_)\`\\__)   (_) (_)\`\\___/'(_,__/'   (_/'       (_/'
                 ( )_) |
                  \\___/'                                                                </pre>
      <div class="tagline">CLI agents at home in VS Code</div>
    </div>

    ${installedAdapters.length > 0 ? `
    <div class="prompt-box">
      <textarea id="prompt-input" placeholder="Type a prompt and launch an agent… (⌘↵ to run)" rows="3"></textarea>
      <div class="prompt-row">
        <select id="prompt-agent">
          ${installedAdapters.map((a, i) => `<option value="${a.id}" ${i === 0 ? 'selected' : ''}>${esc(a.displayName)}</option>`).join('')}
        </select>
        <button id="prompt-run">Run <span class="kbd">⌘↵</span></button>
      </div>
    </div>
    <div class="cwd-note">
      <span>📁</span>
      ${workspacePath ? esc(workspacePath) : '<em>no folder open</em>'}
    </div>` : ''}

    <div class="start-row">
      ${startButtons}
    </div>
    ${emptyStart}

    <div class="columns">
      <div>
        <h2>Recent Sessions</h2>
        ${sessions.length === 0
          ? '<p class="muted" style="text-align:left">No sessions yet.</p>'
          : recentList}
      </div>
      <div>
        <h2>Layouts</h2>
        <div class="tiles">${layoutTiles}</div>

        <div class="footer-actions">
          <a href="#" onclick="post({type:'restoreLayout'});return false;">Reset layout <span class="kbd kbd-lg">${SHORTCUTS.restoreLayout}</span></a>
          <a href="#" onclick="post({type:'resumeLast'});return false;">Resume last <span class="kbd kbd-lg">${SHORTCUTS.resumeLast}</span></a>
          <a href="#" onclick="post({type:'refresh'});return false;">Refresh <span class="kbd kbd-lg">${SHORTCUTS.refresh}</span></a>
        </div>
      </div>
    </div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  let locked = false;
  function post(msg){
    if (locked) return;
    locked = true;
    vscode.postMessage(msg);
    setTimeout(() => { locked = false; }, 600);
  }

  const input = document.getElementById('prompt-input');
  const agent = document.getElementById('prompt-agent');
  const runBtn = document.getElementById('prompt-run');
  function runPrompt(){
    if (!input || !agent) return;
    const prompt = input.value.trim();
    if (!prompt) return;
    post({ type: 'launchPrompt', adapterId: agent.value, prompt });
    input.value = '';
  }
  if (runBtn) runBtn.addEventListener('click', runPrompt);
  if (input) input.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runPrompt(); }
  });
</script>
</body>
</html>`;
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

function relative(ms: number): string {
  const diff = Date.now() - ms;
  const m = 60_000, h = 3_600_000, d = 86_400_000;
  if (diff < m) return 'just now';
  if (diff < h) return `${Math.floor(diff / m)}m ago`;
  if (diff < d) return `${Math.floor(diff / h)}h ago`;
  if (diff < 7 * d) return `${Math.floor(diff / d)}d ago`;
  return new Date(ms).toLocaleDateString();
}

const svgOpts = 'fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"';
const tileSingle = `<svg viewBox="0 0 64 40" ${svgOpts}><rect x="2" y="2" width="60" height="36" rx="3"/></svg>`;
const tileTwoCols = `<svg viewBox="0 0 64 40" ${svgOpts}><rect x="2" y="2" width="28" height="36" rx="3"/><rect x="34" y="2" width="28" height="36" rx="3"/></svg>`;
const tileGrid = `<svg viewBox="0 0 64 40" ${svgOpts}><rect x="2" y="2" width="28" height="17" rx="3"/><rect x="34" y="2" width="28" height="17" rx="3"/><rect x="2" y="21" width="28" height="17" rx="3"/><rect x="34" y="21" width="28" height="17" rx="3"/></svg>`;
const tileTerm = `<svg viewBox="0 0 64 40" ${svgOpts}><rect x="2" y="2" width="60" height="10" rx="3"/><rect x="2" y="14" width="60" height="24" rx="3"/></svg>`;

/** Side activity-bar webview: clicking activity bar opens the hub tab and closes the sidebar. */
export class HubLauncherProvider implements vscode.WebviewViewProvider {
  constructor(private readonly ctx: vscode.ExtensionContext) {}
  resolveWebviewView(view: vscode.WebviewView) {
    view.webview.options = { enableScripts: true };
    view.webview.html = `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:14px;font-size:13px">
      <p style="opacity:0.7">Agent Hub opens in the editor area.</p>
      <p><a href="#" onclick="acquireVsCodeApi().postMessage({type:'open'});return false;" style="color:var(--vscode-textLink-foreground)">Open Agent Hub</a></p>
    </body></html>`;
    const openAndHide = async () => {
      await vscode.commands.executeCommand('agentCommandCenter.openHub');
      // Close this sidebar so it doesn't linger after opening the editor tab.
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
    };
    view.webview.onDidReceiveMessage(openAndHide);
    view.onDidChangeVisibility(() => { if (view.visible) openAndHide(); });
    openAndHide();
  }
}

