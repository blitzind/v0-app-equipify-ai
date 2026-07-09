/** Structured Growth Engine console logging (client-safe). */

export function logGrowthEngine(event: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      source: "growth-engine",
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}
