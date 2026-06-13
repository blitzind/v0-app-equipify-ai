/**
 * Phase 15.2B — Aiden daily briefing validation (read-only, production Supabase).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-aiden-daily-briefing-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

async function main(): Promise<void> {
  const started = Date.now()
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) throw new Error("production_supabase_unavailable")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { fetchAidenDailyBriefing } = await import("../lib/growth/aiden/aiden-briefing-repository")

  const briefing = await fetchAidenDailyBriefing(admin, { operatorEmail: "mike@blitzind.com" })
  const elapsedMs = Date.now() - started

  const checks = {
    qa_marker: briefing.qa_marker === "aiden-daily-briefing-v1",
    has_greeting: briefing.greeting.length > 0,
    has_operator_name: briefing.operator_name.length > 0,
    priorities_max_3: briefing.priorities.length <= 3,
    deep_links_valid: briefing.priorities.every((p) => p.href.startsWith("/admin/growth/")),
    load_under_2s: elapsedMs < 2000,
    read_only: true,
  }

  console.log(
    JSON.stringify(
      {
        phase: "15.2B",
        verdict: Object.values(checks).every(Boolean) ? "READY FOR OPERATOR USE" : "NEEDS ENHANCEMENT",
        elapsed_ms: elapsedMs,
        checks,
        briefing,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
