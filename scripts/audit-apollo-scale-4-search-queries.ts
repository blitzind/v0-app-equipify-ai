/**
 * Apollo Scale-4 Audit — Inspect actual Apollo queries (evidence only).
 *
 * Run (live, requires APOLLO_API_KEY):
 *   pnpm audit:apollo-scale-4-search-queries
 *
 * On Vercel Production (recommended):
 *   Set GROWTH_APOLLO_SEARCH_QUERY_AUDIT_ACK=1 and use browser console snippet from readiness route.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
import { assertApolloLiveBenchmarkAllowed } from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import { runApolloSearchQueryAudit } from "../lib/growth/apollo/apollo-search-query-audit-runner"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

function ensureApolloApiKeyFromLocalEnvFiles(): void {
  if (process.env.APOLLO_API_KEY?.trim() || process.env.GROWTH_APOLLO_API_KEY?.trim()) return

  for (const relativePath of [
    ".env.production.local",
    ".vercel/.env.production.local",
    ".env.local",
    ".env.local.active",
  ]) {
    const absolutePath = resolve(process.cwd(), relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      const parsed = parseGrowthProductionEnvFile(absolutePath, readFileSync(absolutePath, "utf8"))
      const key = parsed.APOLLO_API_KEY?.trim() || parsed.GROWTH_APOLLO_API_KEY?.trim()
      if (key) {
        process.env.APOLLO_API_KEY = key
        return
      }
    } catch {
      /* optional */
    }
  }
}

function applyAuditEnvDefaults(): void {
  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED ??= "true"
  process.env.GROWTH_APOLLO_USE_MOCK ??= "false"
  process.env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK ??= "1"
  process.env.VERCEL_ENV ??= "production"
  process.env.GROWTH_APOLLO_MAX_COMPANIES_PER_RUN ??= "20"
  process.env.GROWTH_APOLLO_MAX_API_CALLS_PER_RUN ??= "30"
}

async function main(): Promise<void> {
  applyAuditEnvDefaults()
  ensureApolloApiKeyFromLocalEnvFiles()

  const liveGate = assertApolloLiveBenchmarkAllowed(process.env)
  if (!liveGate.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "apollo_live_gate_blocked",
        blockers: liveGate.blockers,
        hint: "Run on Vercel Production via /api/platform/growth/apollo-search-query-audit/execute",
      }),
    )
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const audit = await runApolloSearchQueryAudit({ admin, env: process.env })

  console.log(
    JSON.stringify(
      {
        ...audit,
        safety: {
          enrollment: false,
          outreach: false,
          enrichment_pipeline: false,
        },
      },
      null,
      2,
    ),
  )
}

void main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }))
  process.exit(1)
})
