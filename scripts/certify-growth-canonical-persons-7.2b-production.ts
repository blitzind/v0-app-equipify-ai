/**
 * One-shot production certification runner for Phase 7.2B (CLI only).
 * Uses Supabase CLI API keys when process.env service role is invalid.
 *
 *   pnpm tsx scripts/certify-growth-canonical-persons-7.2b-production.ts
 */
import { execSync } from "node:child_process"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { mergeCanonicalPersonBackfillStats } from "@/lib/growth/canonical-persons/canonical-person-backfill-api"
import {
  countUnlinkedStagingPersonSources,
  runCanonicalPersonBackfill,
} from "@/lib/growth/canonical-persons/canonical-person-backfill"
import {
  sumPendingTotal,
  verifyCanonicalPersonBackfillComplete,
} from "@/lib/growth/canonical-persons/canonical-person-backfill-completion"
import {
  GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_PERSON_SOURCE_TABLES,
  type GrowthCanonicalPersonBackfillStats,
} from "@/lib/growth/canonical-persons/canonical-person-types"
import { isGrowthCanonicalPersonSchemaReady } from "@/lib/growth/canonical-persons/canonical-person-schema-health"

function serviceRoleFromCli(projectRef: string): string {
  const raw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const rows = JSON.parse(raw) as Array<{ name: string; api_key: string }>
  const row = rows.find((r) => r.name === "service_role")
  if (!row?.api_key) throw new Error("Could not load service_role from Supabase CLI")
  return row.api_key
}

function aggregateStats(chunks: GrowthCanonicalPersonBackfillStats[]): GrowthCanonicalPersonBackfillStats {
  return chunks.reduce((acc, chunk) => mergeCanonicalPersonBackfillStats(acc, chunk), chunks[0]!)
}

function sumSourceMetric(
  stats: GrowthCanonicalPersonBackfillStats,
  key: keyof GrowthCanonicalPersonBackfillStats["sources"]["contact_candidates"],
): number {
  return GROWTH_CANONICAL_PERSON_SOURCE_TABLES.reduce((n, table) => n + stats.sources[table][key], 0)
}

async function countTable(admin: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from(table)
    .select("id", { count: "exact", head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function runUntilDone(
  admin: SupabaseClient,
  mode: "dry_run" | "apply",
): Promise<ReturnType<typeof runCanonicalPersonBackfill>> {
  let cursor = null
  const statChunks: GrowthCanonicalPersonBackfillStats[] = []
  let last: Awaited<ReturnType<typeof runCanonicalPersonBackfill>> | null = null
  let iterations = 0
  const maxIterations = 5000

  while (iterations < maxIterations) {
    iterations++
    const chunk = await runCanonicalPersonBackfill(admin, {
      mode,
      batchSize: GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE,
      cursor,
    })
    statChunks.push(chunk.stats)
    last = {
      ...chunk,
      stats: statChunks.length > 1 ? aggregateStats(statChunks) : chunk.stats,
    }
    if (chunk.done) return last
    cursor = chunk.cursor
    if (!cursor) throw new Error(`${mode} incomplete without cursor`)
  }
  throw new Error(`${mode} exceeded max iterations`)
}

async function main(): Promise<void> {
  const projectRef = "byyfylkklbxcdofaspye"
  const url = `https://${projectRef}.supabase.co`
  const serviceRoleKey = serviceRoleFromCli(projectRef)
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

  const ready = await isGrowthCanonicalPersonSchemaReady(admin)
  if (!ready) throw new Error("growth.persons schema not ready")

  const countsBefore = {
    persons: await countTable(admin, "persons"),
    emails: await countTable(admin, "person_emails"),
    phones: await countTable(admin, "person_phones"),
    profiles: await countTable(admin, "person_profiles"),
    roles: await countTable(admin, "person_company_roles"),
    lineage: await countTable(admin, "person_source_lineage"),
  }

  const dryRun = await runUntilDone(admin, "dry_run")
  const dryStats = dryRun.stats

  const dryRunReport = {
    phase: "dry_run",
    persons_existing: dryStats.canonical_persons_existing,
    persons_after: dryStats.canonical_persons_after,
    pending_total: dryRun.pending_total,
    pending_by_source: dryRun.pending_by_source,
    email_matches: sumSourceMetric(dryStats, "resolved_normalized_email"),
    linkedin_matches: sumSourceMetric(dryStats, "resolved_normalized_linkedin"),
    phone_matches: sumSourceMetric(dryStats, "resolved_normalized_phone"),
    name_company_matches: sumSourceMetric(dryStats, "resolved_name_company"),
    new_persons: sumSourceMetric(dryStats, "would_create_new"),
    warnings: dryRun.certification === "fail" ? ["pending remains before apply"] : [],
    errors: sumSourceMetric(dryStats, "errors"),
    error_rows: dryRun.error_rows.length,
    done: dryRun.done,
    certification: dryRun.certification,
  }

  const applyRun = await runUntilDone(admin, "apply")
  const applyStats = applyRun.stats

  const countsAfter = {
    persons: await countTable(admin, "persons"),
    emails: await countTable(admin, "person_emails"),
    phones: await countTable(admin, "person_phones"),
    profiles: await countTable(admin, "person_profiles"),
    roles: await countTable(admin, "person_company_roles"),
    lineage: await countTable(admin, "person_source_lineage"),
  }

  const verification = await verifyCanonicalPersonBackfillComplete(admin, countUnlinkedStagingPersonSources)

  const idempotency = await runUntilDone(admin, "dry_run")

  const report = {
    migration: "20270709120000_growth_engine_canonical_persons_7_2b.sql",
    migration_applied: true,
    target: { project_ref: projectRef, schema: "growth" },
    dry_run: dryRunReport,
    apply: {
      persons_created: countsAfter.persons - countsBefore.persons,
      emails_created: countsAfter.emails - countsBefore.emails,
      phones_created: countsAfter.phones - countsBefore.phones,
      profiles_created: countsAfter.profiles - countsBefore.profiles,
      roles_created: countsAfter.roles - countsBefore.roles,
      lineage_created: countsAfter.lineage - countsBefore.lineage,
      errors: sumSourceMetric(applyStats, "errors"),
      error_rows: applyRun.error_rows.length,
      canonical_persons_after: applyStats.canonical_persons_after,
      done: applyRun.done,
      certification: applyRun.certification,
    },
    verification: {
      pending_total: verification.pending_total,
      pending_by_source: verification.pending_by_source,
      passed: verification.passed,
      certification: applyRun.certification,
    },
    idempotency: {
      would_create_new: sumSourceMetric(idempotency.stats, "would_create_new"),
      pending_total: idempotency.pending_total,
      duplicate_candidates: sumSourceMetric(idempotency.stats, "already_linked"),
      certification: idempotency.certification,
      done: idempotency.done,
      verification_passed: idempotency.verification?.passed ?? null,
    },
    counts_before: countsBefore,
    counts_after: countsAfter,
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
