# Agent Command Center (VS Code Extension)

## Vision

Turn VS Code into a **CLI Command Center for AI agents** like Claude CLI, Codex CLI, Cursor, and Gemini.

This extension should make VS Code feel like an IDE built for agent workflows:
- persistent layouts
- multi-agent terminals
- session discovery and resume
- a central “Agent Hub” launch surface

This is **not a terminal extension**.  
It is a **session manager + layout manager + CLI bridge**.

---

## Core Goals

- Welcome/home tab inside VS Code
- Discover local CLI sessions
- Launch new sessions per CLI
- Resume sessions (where supported)
- Manage layouts automatically (no manual pane dragging)
- Support multiple agent CLIs side-by-side

---

## Supported CLIs (Phase 1)

- Claude CLI
- Codex CLI
- Cursor CLI
- Gemini CLI

---

## Key Product Principles

### 1. Capabilities are per CLI

Each CLI adapter may support:

- detect installed
- launch new session
- discover sessions
- resume session

Do not assume all CLIs support all capabilities equally.

---

### 2. Layouts are presets (not freeform)

We do NOT build a custom window manager.

We use:
- VS Code terminals
- editor groups
- built-in layout commands

---

### 3. Session discovery is secondary

Priority:
1. detect CLI
2. launch new session
3. discover sessions
4. resume sessions

---

## Core Features

---

## 1. Agent Hub (Welcome Tab)

A webview-based home screen.

### Responsibilities

- Show installed CLIs
- Show recent sessions per CLI
- Allow new session creation
- Allow session resume (if supported)
- Allow layout selection
- Act as main launchpad

### UI Elements

#### Toolbar

- New Claude Session
- New Codex Session
- New Session dropdown
- Restore Layout
- Refresh Sessions
- Open Settings

#### Session List

Each item shows:
- CLI tool name
- session title
- repo/folder path
- last updated
- session id
- actions:
  - Resume
  - Open in Split
  - Reveal Repo

#### Layout Selector

- Single Agent
- Two Columns
- Grid
- Terminal Focus

---

## 2. Layout Presets

### Goal

Automatically arrange terminals and editors.

---

### Presets

#### Single Agent
- Explorer visible
- one terminal
- editor beside terminal

#### Two Columns
- Explorer visible
- two side-by-side terminals
- editor accessible

#### Grid
- Explorer visible
- terminals in grid layout
- editor still accessible

#### Terminal Focus
- Explorer visible
- large terminal area
- minimal editor

---

### Settings

```json
{
  "agentCommandCenter.defaultLayoutPreset": "two-columns",
  "agentCommandCenter.useEditorAreaTerminals": true,
  "agentCommandCenter.focusTerminalOnLaunch": true,
  "agentCommandCenter.keepExplorerVisible": true,
  "agentCommandCenter.preferredTerminalArrangement": "auto"
}

interface CliAdapter {
  id: string
  displayName: string

  detectInstalled(): Promise<boolean>

  capabilities: {
    canLaunchNew: boolean
    canDiscoverSessions: boolean
    canResumeSession: boolean
  }

  discoverSessions(): Promise<CliSession[]>

  buildNewCommand(context: LaunchContext): string

  buildResumeCommand(session: CliSession, context: LaunchContext): string
}

interface CliSession {
  adapterId: string
  sessionId: string
  title: string
  workspacePath?: string
  cwd?: string
  updatedAt?: number
}

interface LaunchContext {
  cwd?: string
  layoutPreset: 'single-agent' | 'two-columns' | 'grid' | 'terminal-focus'
  openInEditorArea?: boolean
  focusTerminal?: boolean
}

4. Session Index

Responsible for:

collecting sessions from all adapters
normalizing
sorting by time
caching
5. Terminal Launcher

Responsible for:

creating terminals
assigning cwd
naming terminals
sending commands
6. Layout Manager

Responsible for:

applying layout presets
preparing editor groups
revealing explorer
placing terminals correctly
7. Sidebar View

Tree view with:

tools
recent sessions

Clicking resumes session.

8. Commands
Open Agent Hub
Refresh Sessions
Restore Layout
New Claude Session
New Codex Session
Resume Session
Resume Last Session
Scan Installed CLIs
9. MCP Bridge (CLI ↔ VS Code)
Goal

Allow CLI agents to control VS Code via tools.

CLI (Claude / Codex)
        ↓
     MCP tools
        ↓
 Local MCP Server / Bridge
        ↓
 VS Code Extension
        ↓
 VS Code APIPhase 11A: Embedded Bridge (MVP)

VS Code extension starts a local server.

Endpoints
Open File
POST /open-file
{
  "path": "src/app.ts",
  "line": 42
}
Create Terminal
POST /create-terminal
{
  "name": "backend",
  "cwd": "apps/api"
}
Send Terminal Text
POST /send-terminal-text
{
  "text": "npm test"
}
Apply Layout
POST /apply-layout
{
  "preset": "two-columns"
}
Open URL
POST /open-url
{
  "url": "http://localhost:3000"
}
Show Agent Hub
POST /show-agent-hub
Tool Naming (future MCP)
vscode_open_file
vscode_create_terminal
vscode_send_terminal_text
vscode_apply_layout
vscode_open_url
vscode_show_agent_hub
Security
localhost only
validate inputs
restrict to workspace paths
log actions
Phase 11B: Full MCP
extract bridge into standalone process
register with Claude / Codex
reuse same tool schema
Architecture
src/
  extension.ts
  commands/
  adapters/
  sessions/
  layout/
  terminals/
  webview/
  tree/
  config/
  types/
  util/
MVP Acceptance Criteria
Agent Hub opens
CLIs detected
New session works
Layout applies automatically
Terminals open side-by-side
Explorer remains visible
Sessions appear (where supported)
Sidebar shows sessions
Future Ideas
pin sessions
search
tagging
multi-session launch
workspace-specific layouts
full MCP integration
agent notifications

---

## Quick tip

If you want a real downloadable file instantly:

1. Paste into a file named:
   `agent-command-center.md`
2. Or run:

```bash
pbpaste > agent-command-center.md


