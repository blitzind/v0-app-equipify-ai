/**
 * Read-only production probe for Growth Engine 500 routes.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/debug-growth-engine-500-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

type Probe = { route: string; ok: boolean; error?: string; detail?: Record<string, unknown> }

async function probe(name: string, fn: () => Promise<unknown>): Promise<Probe> {
  try {
    const result = await fn()
    return {
      route: name,
      ok: true,
      detail: {
        type: result === null ? "null" : Array.isArray(result) ? `array:${result.length}` : typeof result,
        keys: result && typeof result === "object" && !Array.isArray(result) ? Object.keys(result as object).slice(0, 8) : undefined,
      },
    }
  } catch (error) {
    return {
      route: name,
      ok: false,
      error: error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error),
    }
  }
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { fetchGrowthSequenceSafeExecutionDashboard } = await import(
    "../lib/growth/sequences/execution/sequence-execution-dashboard"
  )
  const { fetchRevenueWorkflowWorkspaceDashboard } = await import(
    "../lib/growth/revenue-workflow/revenue-workflow-workspace"
  )
  const { fetchAidenRevenueJourneyTracker } = await import("../lib/growth/aiden/aiden-revenue-journey-tracker")

  const probes = await Promise.all([
    probe("/api/platform/growth/sequences/execution/dashboard", () =>
      fetchGrowthSequenceSafeExecutionDashboard(admin),
    ),
    probe("/api/platform/growth/revenue-workflow/workspace?limit=25", () =>
      fetchRevenueWorkflowWorkspaceDashboard(admin, { limit: 25 }),
    ),
    probe("/api/platform/growth/aiden/revenue-journey?limit=25", () =>
      fetchAidenRevenueJourneyTracker(admin, { limit: 25 }),
    ),
  ])

  console.log(JSON.stringify({ ok: probes.every((p) => p.ok), probes }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
