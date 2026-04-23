import * as fs from 'fs';
import * as path from 'path';

/**
 * Check whether a command is available on PATH.
 *
 * Walks the PATH environment variable and checks for an executable file.
 * Never invokes a shell, so user-controlled `cmd` values (from settings)
 * cannot trigger command injection.
 */
export async function which(cmd: string): Promise<boolean> {
  if (!cmd || typeof cmd !== 'string') return false;
  // If an absolute or relative path was given, check it directly.
  if (cmd.includes('/') || cmd.includes('\\')) {
    return isExecutable(cmd);
  }
  const PATH = process.env.PATH ?? '';
  const parts = PATH.split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').map((e) => e.toLowerCase())
    : [''];
  for (const dir of parts) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      if (isExecutable(candidate)) return true;
    }
  }
  return false;
}

function isExecutable(p: string): boolean {
  try {
    const stat = fs.statSync(p);
    if (!stat.isFile()) return false;
    if (process.platform === 'win32') return true; // PATHEXT already narrows it.
    // On POSIX, check the user has execute permission.
    try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
  } catch {
    return false;
  }
}
