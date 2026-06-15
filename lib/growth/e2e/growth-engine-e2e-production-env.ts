/** Phase GE-HARDEN-1 — Production certification env bootstrap (client-safe). */

/**
 * Sets env vars required by individual GS subsystem certifications when
 * running under vercel-production-env-run (not stored in .env.local).
 */
export function bootstrapGrowthEngineE2EProductionEnv(): void {
  process.env.VERCEL_ENV = process.env.VERCEL_ENV ?? "production"
  process.env.GROWTH_SIGNAL_INTELLIGENCE_ENABLED = "true"
  process.env.GROWTH_SIGNAL_INTELLIGENCE_ACK = "1"
}
