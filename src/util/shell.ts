/** Quote a string safely for a POSIX shell using single quotes. */
export function shellQuote(s: string): string {
  if (s === '') return "''";
  // Close single-quote, insert escaped single-quote, reopen.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
