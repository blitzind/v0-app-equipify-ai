/**
 * Phase 7.2B — Canonical person backfill (dry-run default, production only).
 *
 *   pnpm tsx scripts/backfill-growth-canonical-persons-7.2b.ts
 *   GROWTH_CANONICAL_PERSON_APPLY_CONFIRM=yes pnpm tsx scripts/backfill-growth-canonical-persons-7.2b.ts --apply
 *
 *   --full  Process all rows in one run (no chunking; may be slow locally).
 *
 * Requires production env in shell:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: --local to allow localhost Supabase (not for production backfill).
 */
import { createClient } from "@supabase/supabase-js"
import { runCanonicalPersonBackfill } from "../lib/growth/canonical-persons/canonical-person-backfill"
import {
  formatGrowthProductionTargetBanner,
  resolveGrowthProductionSupabaseConfig,
} from "../lib/growth/canonical-companies/load-growth-production-supabase-env"
import { isGrowthCanonicalPersonSchemaReady } from "../lib/growth/canonical-persons/canonical-person-schema-health"
import {
  GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_PERSON_QA_MARKER,
  type GrowthCanonicalPersonBackfillCursor,
} from "../lib/growth/canonical-persons/canonical-person-types"

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

  if (apply && process.env.GROWTH_CANONICAL_PERSON_APPLY_CONFIRM !== "yes") {
    console.error(
      JSON.stringify({
        error: "apply_blocked",
        hint: "Set GROWTH_CANONICAL_PERSON_APPLY_CONFIRM=yes to run apply mode",
      }),
    )
    process.exit(1)
  }

  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const ready = await isGrowthCanonicalPersonSchemaReady(admin)
  if (!ready) {
    console.error(
      JSON.stringify({
        error: "schema_not_ready",
        hint: "Apply migration 20270709120000_growth_engine_canonical_persons_7_2b.sql first",
      }),
    )
    process.exit(1)
  }

  let cursor: GrowthCanonicalPersonBackfillCursor | null = null
  let chunks = 0
  let finalReport: Awaited<ReturnType<typeof runCanonicalPersonBackfill>> | null = null

  do {
    chunks++
    const chunk = await runCanonicalPersonBackfill(admin, {
      mode,
      batchSize: full ? undefined : GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE,
      cursor: full ? null : cursor,
    })
    finalReport = chunk
    cursor = chunk.done ? null : chunk.cursor
    console.error(
      JSON.stringify({
        qa_marker: GROWTH_CANONICAL_PERSON_QA_MARKER,
        chunk: chunks,
        done: chunk.done,
        certification: chunk.certification,
        pending_total: chunk.pending_total,
        processed_in_chunk: chunk.progress.processed_in_chunk,
        current_source_table: chunk.progress.current_source_table,
      }),
    )
  } while (cursor)

  console.log(JSON.stringify(finalReport, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
