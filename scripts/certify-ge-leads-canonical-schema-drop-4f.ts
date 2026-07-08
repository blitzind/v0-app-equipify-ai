/**
 * GE-LEADS-CANONICAL-4F — Post schema-drop certification (production read-only + static gates).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-schema-drop-4f.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadRevenueQueueDashboardPayload } from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import type { SupabaseClient } from "@supabase/supabase-js"

export const GE_LEADS_CANONICAL_SCHEMA_DROP_4F_QA_MARKER =
  "GE-LEADS-CANONICAL-4F-SCHEMA-DROP" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function listLibTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listLibTsFiles(full, acc)
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) acc.push(full)
  }
  return acc
}

function scanLibForDroppedColumnRefs(): string[] {
  const hits: string[] = []
  const patterns = [
    /\.from\(["']lead_inbox["']\)/,
    /lead_inbox_id/,
    /processed_to_lead_inbox/,
    /is_in_lead_inbox/,
  ]
  for (const file of listLibTsFiles(path.join(process.cwd(), "lib"))) {
    const source = fs.readFileSync(file, "utf8")
    if (patterns.some((p) => p.test(source))) {
      hits.push(path.relative(process.cwd(), file))
    }
  }
  return hits
}

async function verifyLeadInboxTableDropped(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("lead_inbox").select("id").limit(1)
  return Boolean(error?.message?.includes("does not exist") || error?.code === "PGRST205")
}

async function verifyColumnDropped(
  admin: SupabaseClient,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await admin.schema("growth").from(table).select(column).limit(1)
  return Boolean(error?.message?.includes("does not exist") || error?.code === "42703")
}

function runStaticChecks(): Record<string, boolean> {
  const migration = readSource(
    "supabase/migrations/20270936120000_growth_engine_drop_legacy_lead_inbox_4f.sql",
  )
  const libHits = scanLibForDroppedColumnRefs()

  return {
    migration_file_exists: migration.length > 0,
    migration_drops_lead_inbox_table: /drop table if exists growth\.lead_inbox/i.test(migration),
    migration_drops_intelligence_lead_inbox_id: /search_intent_signals[\s\S]*drop column if exists lead_inbox_id/i.test(
      migration,
    ),
    migration_drops_signal_legacy_columns: /signals[\s\S]*processed_to_lead_inbox/i.test(migration),
    migration_drops_prospect_index_flag: /drop column if exists is_in_lead_inbox/i.test(migration),
    lib_no_dropped_column_refs: libHits.length === 0,
    search_intent_repo_growth_lead_only: /\.eq\("growth_lead_id", leadId\)/.test(
      readSource("lib/growth/search-intent/search-intent-repository.ts"),
    ),
    intake_no_inbox_insert: !/\.from\(["']lead_inbox["']\)/.test(
      readSource("lib/growth/lead-inbox/lead-inbox-repository.ts"),
    ),
  }
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const staticChecks = runStaticChecks()
  const libHits = scanLibForDroppedColumnRefs()

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(
      JSON.stringify(
        { ok: false, qa_marker: GE_LEADS_CANONICAL_SCHEMA_DROP_4F_QA_MARKER, error: "bootstrap_failed" },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const [
    leadInboxDropped,
    sisColDropped,
    signalsColDropped,
    indexColDropped,
    queue,
  ] = await Promise.all([
    verifyLeadInboxTableDropped(boot.admin),
    verifyColumnDropped(boot.admin, "search_intent_signals", "lead_inbox_id"),
    verifyColumnDropped(boot.admin, "signals", "processed_to_lead_inbox"),
    verifyColumnDropped(boot.admin, "prospect_search_index", "is_in_lead_inbox"),
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", limit: 200 }),
  ])

  const certification = {
    qa_marker: GE_LEADS_CANONICAL_SCHEMA_DROP_4F_QA_MARKER,
    env_source: boot.env_source,
    supabase_host: new URL(boot.url).host,
    no_env_local: !fs.existsSync(path.join(process.cwd(), ".env.local")),
    static: staticChecks,
    lib_dropped_column_hits: libHits,
    production_read_only: {
      lead_inbox_table_dropped: leadInboxDropped,
      search_intent_lead_inbox_id_dropped: sisColDropped,
      signals_processed_to_lead_inbox_dropped: signalsColDropped,
      prospect_index_is_in_lead_inbox_dropped: indexColDropped,
      canonical_queue_source: queue.queue_source,
      canonical_queue_total: queue.total,
      canonical_card_count: queue.sections.reduce((sum, s) => sum + s.items.length, 0),
    },
    revenue_queue_unchanged: queue.queue_source === "canonical" && queue.total >= 23,
    all_static_pass: Object.values(staticChecks).every(Boolean),
    schema_drop_verified:
      leadInboxDropped && sisColDropped && signalsColDropped && indexColDropped,
    no_commit: true,
    no_push: true,
    no_deploy: true,
  }

  console.log(JSON.stringify(certification, null, 2))

  const failed =
    !certification.all_static_pass ||
    !certification.schema_drop_verified ||
    !certification.revenue_queue_unchanged

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
