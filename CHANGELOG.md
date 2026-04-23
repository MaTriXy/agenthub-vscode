# Changelog

## 0.0.15 — 2026-04-23

Fixes hub buttons.

- The CSP added in 0.0.14 blocked inline `onclick` handlers, so nothing in
  the Agent Hub was clickable — layout tiles, recent sessions, footer
  links. Converted every handler to `data-action` attributes driven by a
  single delegated listener inside the nonce-allowed `<script>` block.

## 0.0.14 — 2026-04-23

Pre-release hardening pass.

- **Security**: `which()` no longer shells out — walks `PATH` directly, removing a command-injection vector when users configure custom CLI paths in settings.
- **Security**: session IDs are now POSIX-quoted in Claude/Codex resume commands, preventing any shell interpretation of transcript filenames.
- **Privacy**: dropped the `microsoft.github.io/vscode-codicons` CDN load — the hub no longer makes any network request. Inline Unicode glyphs replace codicons.
- **Hardening**: explicit Content-Security-Policy on the hub webview with a per-render script nonce.

## 0.0.13 — 2026-04-22

First Marketplace release.

- Initial publication of **Agent Hub**.
- Retro ASCII home tab with prompt input, Start row, Layouts, and Recent Sessions (cap 10).
- Adapters: Claude (launch + resume + discovery), Codex (launch + resume + discovery), Cursor (launch), Gemini (launch).
- Session transcript parser pulls real first-user-message titles from `.jsonl` files.
- Explorer sidebar "Agent Sessions" section grouped by CLI, auto-refreshes on open.
- 13 keyboard shortcuts covering hub, new sessions, resume, refresh, and layouts.
- Workspace path shown under the prompt.
- Activity Bar rocket + status bar button open the hub tab.
