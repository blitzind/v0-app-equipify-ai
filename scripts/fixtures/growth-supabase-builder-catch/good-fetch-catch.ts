/** Fixture: must PASS scan — normal Promise fetch().catch(). */
export async function goodFetchCatch(url: string) {
  return fetch(url).catch(() => null)
}
