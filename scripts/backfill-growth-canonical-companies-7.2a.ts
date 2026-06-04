/**
 * Phase 7.2A — Canonical company backfill (dry-run default, production only).
 *
 *   pnpm tsx scripts/backfill-growth-canonical-companies-7.2a.ts
 *   GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM=yes pnpm tsx scripts/backfill-growth-canonical-companies-7.2a.ts --apply
 *
 *   --full  Process all rows in one run (no chunking; may be slow locally).
 *
 * Requires production env in shell:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: --local to allow localhost Supabase (not for production backfill).
 */
import { createClient } from "@supabase/supabase-js"
import { runCanonicalCompanyBackfill } from "../lib/growth/canonical-companies/canonical-company-backfill"
import {
  formatGrowthProductionTargetBanner,
  resolveGrowthProductionSupabaseConfig,
} from "../lib/growth/canonical-companies/load-growth-production-supabase-env"
import { isGrowthCanonicalCompanySchemaReady } from "../lib/growth/canonical-companies/canonical-company-schema-health"
import {
  GROWTH_CANONICAL_COMPANY_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
  type GrowthCanonicalCompanyBackfillCursor,
} from "../lib/growth/canonical-companies/canonical-company-types"

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply")
  const allowLocal = process.argv.includes("--local")
  const full = process.argv.includes("--full")
  const mode = apply ? "apply" : "dry_run"

  let config
  try {
    config = resolveGrowthProductionSupabaseConfig({ allowLocal })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ error: "production_supabase_config", message }))
    process.exit(1)
  }

  console.error(JSON.stringify(formatGrowthProductionTargetBanner(config, mode), null, 2))

  if (apply && process.env.GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM !== "yes") {
    console.error(
      JSON.stringify({
        error: "apply_blocked",
        hint: "Set GROWTH_CANONICAL_COMPANY_APPLY_CONFIRM=yes to run apply mode",
      }),
    )
    process.exit(1)
  }

  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const ready = await isGrowthCanonicalCompanySchemaReady(admin)
  if (!ready) {
    console.error(
      JSON.stringify({
        error: "schema_not_ready",
        hint: "Apply migration 20270708120000_growth_engine_canonical_companies_7_2a.sql first",
      }),
    )
    process.exit(1)
  }

  let cursor: GrowthCanonicalCompanyBackfillCursor | null = null
  let chunks = 0
  let finalReport: Awaited<ReturnType<typeof runCanonicalCompanyBackfill>> | null = null

  do {
    chunks++
    const chunk = await runCanonicalCompanyBackfill(admin, {
      mode,
      batchSize: full ? undefined : GROWTH_CANONICAL_COMPANY_BACKFILL_DEFAULT_BATCH_SIZE,
      cursor: full ? null : cursor,
    })
    finalReport = chunk
    cursor = chunk.cursor
    console.error(
      JSON.stringify({
        chunk: chunks,
        done: chunk.done,
        processed_in_chunk: chunk.progress.processed_in_chunk,
        source_table: chunk.progress.current_source_table,
      }),
    )
  } while (!full && finalReport && !finalReport.done)

  if (!finalReport) {
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_CANONICAL_COMPANY_QA_MARKER,
        chunks,
        ...formatGrowthProductionTargetBanner(config, mode),
        ...finalReport.stats,
        done: finalReport.done,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
