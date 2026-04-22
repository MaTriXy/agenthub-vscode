# Agent Hub

> A CLI command center for AI coding agents — **Claude, Codex, Cursor, Gemini** — inside VS Code.

Agent Hub is a VS Code extension that turns the editor into a launch surface for AI CLI agents. One retro home tab, keyboard shortcuts, layout presets, real session titles, and a sidebar that lists every conversation you've ever had across every tool.

```
     _     _____                       _       _   _         _                __  _
   /' )   (  _  )                     ( )_    ( ) ( )       ( )              /  )( `\
 /' /'    | (_) |   __     __    ___  | ,_)   | |_| | _   _ | |_           /' /'  `\ `\
<  <      |  _  | /'_ `\ /'__`\/' _ `\| |     |  _  |( ) ( )| '_`\       /' /'      >  >
 \  `\    | | | |( (_) |(  ___/| ( ) || |_    | | | || (_) || |_) )    /' /'      /' /'
  `\__)   (_) (_)`\__  |`\____)(_) (_)`\__)   (_) (_)`\___/'(_,__/'   (_/'       (_/'
                 ( )_) |
                  \___/'
```

## What it does

### Hero tab
A Welcome-style home screen you open with the Activity Bar rocket, status bar button, or `⌘⌥A`.

- **Start row** — one-click launchers for every installed CLI (only installed ones appear).
- **Prompt box** — type a prompt, pick an agent, `⌘↵` runs `claude 'your prompt'` (or the equivalent for the selected CLI). Shows your current workspace path underneath.
- **Recent sessions** — last 10 conversations across all CLIs, with real titles parsed from the transcript (first user message, not just the folder name).
- **Layouts** — 4 editor-area presets with imagery and big shortcut badges.

### Multi-agent support
Each CLI has its own adapter with capability flags — no assumption that every tool supports every action.

| CLI | Launch | Resume | Session discovery |
|---|---|---|---|
| **Claude** | ✅ | ✅ by session id | ✅ `~/.claude/projects/**/*.jsonl` |
| **Codex** | ✅ | ✅ by rollout path | ✅ `~/.codex/sessions/**/*.jsonl` |
| **Cursor** | ✅ | — | — |
| **Gemini** | ✅ | — | — |

Session titles are parsed from the first user message. Working directories are extracted from each transcript's `cwd` field so paths with dots in them (like `/Users/alon.carmel/…`) resolve correctly.

### Explorer sidebar section
An **Agent Sessions** group joins Explorer / Outline / Timeline in the built-in sidebar. Each CLI is a collapsible node; expand to see its sessions; click to resume in a new terminal. Auto-refreshes when you peek.

### Layout presets
- **Single** — one terminal alongside the editor
- **Two Columns** — side-by-side terminals
- **Grid** — 2×2 editor group grid
- **Terminal Focus** — maximized panel for long-running agent sessions

## Keyboard shortcuts

| Command | Mac | Win/Linux |
|---|---|---|
| Open Agent Hub | `⌘⌥A` | `Ctrl+Alt+A` |
| New Claude Session | `⌘⌥C` | `Ctrl+Alt+C` |
| New Codex Session | `⌘⌥X` | `Ctrl+Alt+X` |
| New Cursor Session | `⌘⌥U` | `Ctrl+Alt+U` |
| New Gemini Session | `⌘⌥G` | `Ctrl+Alt+G` |
| Resume Last Session | `⌘⌥R` | `Ctrl+Alt+R` |
| Resume Session… (picker) | `⌘⌥⇧R` | `Ctrl+Alt+Shift+R` |
| Refresh Sessions | `⌘⌥⇧F` | `Ctrl+Alt+Shift+F` |
| Reset Layout | `⌘⌥0` | `Ctrl+Alt+0` |
| Layout: Single | `⌘⌥1` | `Ctrl+Alt+1` |
| Layout: Two Columns | `⌘⌥2` | `Ctrl+Alt+2` |
| Layout: Grid | `⌘⌥3` | `Ctrl+Alt+3` |
| Layout: Terminal Focus | `⌘⌥4` | `Ctrl+Alt+4` |

All commands are also reachable from the Command Palette under the **Agent Hub** category.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `agentCommandCenter.defaultLayoutPreset` | `two-columns` | Layout applied when launching a session |
| `agentCommandCenter.useEditorAreaTerminals` | `true` | Open terminals as editor tabs (vs. bottom panel) |
| `agentCommandCenter.focusTerminalOnLaunch` | `true` | Focus the new terminal on launch |
| `agentCommandCenter.keepExplorerVisible` | `true` | Keep the Explorer view visible after applying a layout |
| `agentCommandCenter.claudeCommand` | `claude` | Command used to launch Claude CLI |
| `agentCommandCenter.codexCommand` | `codex` | Command used to launch Codex CLI |
| `agentCommandCenter.cursorCommand` | `cursor-agent` | Command used to launch Cursor CLI |
| `agentCommandCenter.geminiCommand` | `gemini` | Command used to launch Gemini CLI |

Override any of these per-project in `.vscode/settings.json`.

## Install

### From VSIX

**One-liner:**
```bash
curl -LO https://github.com/aloncarmel/agenthub/raw/main/agent-hub-0.0.12.vsix
code --install-extension agent-hub-0.0.12.vsix
```

**Or manually:** download [`agent-hub-0.0.12.vsix`](https://github.com/aloncarmel/agenthub/raw/main/agent-hub-0.0.12.vsix) → in VS Code: **Extensions → ⋯ menu → Install from VSIX…** → pick the file.

### Requirements
Agent Hub is a launcher — install whichever CLIs you want side-by-side:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm i -g @anthropic-ai/claude-code`
- [Codex CLI](https://github.com/openai/codex) — `npm i -g @openai/codex`
- Cursor CLI — bundled with Cursor
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)

The extension auto-detects which are installed and only shows launchers for the ones it finds on `PATH`.

## Build locally

```bash
git clone https://github.com/aloncarmel/agenthub.git
cd agenthub
npm install
npm run compile

# Run in a dev Extension Host
#  → open the folder in VS Code and press F5

# Package as VSIX
npx @vscode/vsce package --allow-missing-repository
```

## Architecture

```
src/
  extension.ts           activation, command wiring, shared refresh loop
  adapters/              one per CLI — detect, discover sessions, build commands
  sessions/              merges adapter output, sorts by recency, caches
  layout/                applies editor-group + terminal presets
  terminals/             stock VS Code terminal launcher
  tree/                  Explorer "Agent Sessions" tree data provider
  webview/               the retro home tab
  util/                  output channel, shell quoting
  types/                 shared interfaces
```

Everything the extension needs from the filesystem is read with byte-capped `fs.read` — no streaming parsers that can stall on multi-MB transcripts with huge system-prompt lines.

## Roadmap

- [ ] **Agent Message Queue integration** — detect [AMQ](https://github.com/avivsinai/agent-message-queue); surface inboxes, send cross-agent messages from the Hub, toast on arrivals.
- [ ] **Headless agent runs** — kick off a Claude/Codex session from the Hub without opening a terminal; stream results into a Hub panel.
- [ ] **MCP bridge** — let running CLIs call back into VS Code: `open_file`, `notify`, `ask`, `apply_layout`, `attach_file`.
- [ ] **Workspace-specific layouts** — remember the layout used per project.
- [ ] **Session search, pinning, tagging.**
- [ ] **Agent-to-agent handoff UI** — kanban-ish view of active agent threads.

## Known limitations

- Activity-bar icons always open a sidebar; Agent Hub's launcher view auto-dismisses after opening the home tab in the editor area (VS Code quirk, not ours).
- File drag-and-drop into terminals is limited by VS Code's own terminal implementation — dropped files paste as paths, not bytes. See [microsoft/vscode#152990](https://github.com/microsoft/vscode/issues/152990).
- Session titles are heuristic; malformed or encrypted transcripts fall back to folder names.

## Contributing

PRs welcome. Please:
1. Target `main`.
2. Keep adapters pure — no VS Code API inside `src/adapters/*`.
3. Bump `version` in `package.json` when you ship a user-visible change.

## License

MIT © Alon Carmel
