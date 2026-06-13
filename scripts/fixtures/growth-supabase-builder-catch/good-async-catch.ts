/** Fixture: must PASS scan — normal async function .catch(). */
export function goodAsyncCatch() {
  return someAsyncFunction().catch(() => undefined)
}

async function someAsyncFunction(): Promise<string> {
  return "ok"
}
