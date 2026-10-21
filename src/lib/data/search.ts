/**
 * Make user text safe for a PostgREST `.or()` filter or an ilike pattern.
 * Commas, parentheses, quotes and backslashes break the filter grammar;
 * % and _ are ilike wildcards the user shouldn't be able to inject.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,()"\\%_]/g, " ").replace(/\s+/g, " ").trim();
}
