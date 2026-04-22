import { exec } from 'child_process';

export function which(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
    exec(probe, { shell: process.platform === 'win32' ? undefined : '/bin/sh' } as any, (err, stdout) => {
      const out = typeof stdout === 'string' ? stdout : stdout?.toString() ?? '';
      resolve(!err && out.trim().length > 0);
    });
  });
}
