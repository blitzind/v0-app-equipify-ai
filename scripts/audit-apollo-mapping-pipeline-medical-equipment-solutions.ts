/**
 * Apollo mapping pipeline audit — Medical Equipment Solutions (evidence only).
 * Run: pnpm audit:apollo-mapping-pipeline:medical-equipment-solutions
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
import { assertApolloLiveBenchmarkAllowed } from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import { runApolloMappedContactPipelineAudit } from "../lib/growth/apollo/apollo-mapped-contact-pipeline-audit-runner"

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

async function main(): Promise<void> {
  process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED ??= "true"
  process.env.GROWTH_APOLLO_USE_MOCK ??= "false"
  process.env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK ??= "1"
  ensureApolloApiKeyFromLocalEnvFiles()

  const liveGate = assertApolloLiveBenchmarkAllowed(process.env)
  if (!liveGate.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "apollo_live_gate_blocked",
        hint: "Run on Vercel Production via /api/platform/growth/apollo-mapping-pipeline-audit/execute",
      }),
    )
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const report = await runApolloMappedContactPipelineAudit({ admin, env: process.env })

  console.log(
    JSON.stringify(
      {
        ok: true,
        safety: { enrollment: false, outreach: false, promotion_mutations: false },
        report,
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
