/**
 * EC-6 — provision isolated revenue fixtures on cert org (production DB).
 *
 * Usage:
 *   pnpm provision:equipify-core-revenue-fixtures:vercel
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapEquipifyCoreCertSupabase } from "../lib/certification/equipify-core-production-certification"
import {
  EQUIPIFY_CORE_REVENUE_FIXTURES_QA_MARKER,
  provisionEquipifyCoreRevenueFixtures,
  resolveCertOrganizationIdFromEnv,
} from "../lib/certification/equipify-core-revenue-fixtures"

async function main(): Promise<void> {
  console.log(`\n=== EC-6 revenue fixture provision (${EQUIPIFY_CORE_REVENUE_FIXTURES_QA_MARKER}) ===\n`)

  const organizationId = resolveCertOrganizationIdFromEnv()
  const boot = await bootstrapEquipifyCoreCertSupabase()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "supabase_bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const report = await provisionEquipifyCoreRevenueFixtures(admin, organizationId)
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  process.exit(1)
})
