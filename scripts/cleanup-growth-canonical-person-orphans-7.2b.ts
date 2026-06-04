/**
 * Phase 7.2B — Remove orphan growth.persons (no lineage, channels, or roles).
 *
 *   pnpm cleanup:growth-canonical-person-orphans-7.2b
 *   pnpm cleanup:growth-canonical-person-orphans-7.2b --apply
 *
 * Requires production env (or --local for localhost):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js"
import { runCanonicalPersonOrphanCleanup } from "../lib/growth/canonical-persons/canonical-person-orphan-cleanup"
import {
  formatGrowthProductionTargetBanner,
  resolveGrowthProductionSupabaseConfig,
} from "../lib/growth/canonical-companies/load-growth-production-supabase-env"

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply")
  const allowLocal = process.argv.includes("--local")

  let config
  try {
    config = resolveGrowthProductionSupabaseConfig({ allowLocal })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ error: "production_supabase_config", message }))
    process.exit(1)
  }

  console.error(formatGrowthProductionTargetBanner(config))

  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const result = await runCanonicalPersonOrphanCleanup(admin, { apply })
  console.log(
    JSON.stringify(
      {
        ...result,
        hint: apply
          ? "Orphans deleted."
          : "Dry run only. Re-run with --apply to delete listed person_ids.",
      },
      null,
      2,
    ),
  )

  if (result.orphan_count > 0 && !apply) {
    process.exitCode = 0
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
