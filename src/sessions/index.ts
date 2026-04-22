import { CliAdapter, CliSession } from '../types';
import { log } from '../util/output';

export class SessionIndex {
  private cache: CliSession[] = [];
  constructor(private adapters: CliAdapter[]) {}

  async refresh(): Promise<CliSession[]> {
    const all: CliSession[] = [];
    for (const a of this.adapters) {
      if (!a.capabilities.canDiscoverSessions) continue;
      try {
        const s = await a.discoverSessions();
        log(`${a.id}: discovered ${s.length} sessions`);
        all.push(...s);
      } catch (err) {
        const msg = err instanceof Error ? err.stack ?? err.message : String(err);
        log(`${a.id}: discoverSessions threw — ${msg}`);
      }
    }
    all.sort((x, y) => (y.updatedAt ?? 0) - (x.updatedAt ?? 0));
    this.cache = all;
    if (all[0]) log(`sessions: newest is ${all[0].adapterId} "${all[0].title}" @ ${new Date(all[0].updatedAt ?? 0).toISOString()}`);
    return all;
  }

  get(): CliSession[] {
    return this.cache;
  }
}
