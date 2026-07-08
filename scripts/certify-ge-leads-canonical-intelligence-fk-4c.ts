/**
 * GE-LEADS-CANONICAL-4C — Intelligence table growth_lead_id migration certification.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-intelligence-fk-4c.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  loadRevenueQueueDashboardPayload,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import type { SupabaseClient } from "@supabase/supabase-js"

export const GE_LEADS_CANONICAL_INTELLIGENCE_FK_4C_QA_MARKER =
  "GE-LEADS-CANONICAL-4C-INTELLIGENCE-FK" as const

const INTELLIGENCE_TABLES = [
  "search_intent_signals",
  "buying_stage_assessments",
  "company_identification_matches",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function verifyLeadInboxTableDropped(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("lead_inbox").select("id").limit(1)
  return Boolean(error?.message?.includes("does not exist") || error?.code === "PGRST205")
}

async function probeGrowthLeadIdColumn(
  admin: SupabaseClient,
  table: (typeof INTELLIGENCE_TABLES)[number],
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from(table)
    .select("growth_lead_id")
    .limit(1)
  return !error
}

function runStaticChecks(): Record<string, boolean> {
  const migration = readSource(
    "supabase/migrations/20270830130000_growth_engine_intelligence_growth_lead_id_4c.sql",
  )
  const searchRepo = readSource("lib/growth/search-intent/search-intent-repository.ts")
  const buyingRepo = readSource("lib/growth/buying-stage/buying-stage-repository.ts")
  const companyRepo = readSource("lib/growth/company-identification/company-identification-repository.ts")
  const loader = readSource("lib/growth/lead-inbox/lead-inbox-loader.ts")
  const index = readSource("lib/growth/prospect-search/prospect-search-index.ts")

  return {
    migration_adds_growth_lead_id:
      INTELLIGENCE_TABLES.every((table) => migration.includes(`growth.${table}`)) &&
      /growth_lead_id uuid references growth\.leads/.test(migration),
    migration_includes_backfill: /metadata ->> 'growth_lead_id'/.test(migration),
    search_repo_writes_growth_lead_id: /growth_lead_id: signal\.growth_lead_id/.test(searchRepo),
    search_repo_loads_by_growth_lead_id: /\.eq\("growth_lead_id", leadId\)/.test(searchRepo),
    buying_repo_writes_growth_lead_id: /growth_lead_id: context\.growth_lead_id/.test(buyingRepo),
    buying_repo_loads_by_growth_lead_id: /\.eq\("growth_lead_id", leadId\)/.test(buyingRepo),
    company_repo_writes_growth_lead_id: /growth_lead_id: context\.growth_lead_id/.test(companyRepo),
    company_repo_loads_by_growth_lead_id: /\.eq\("growth_lead_id", leadId\)/.test(companyRepo),
    intent_loader_persists_growth_lead_id: /growth_lead_id: growthLeadId/.test(loader),
    prospect_index_overlays_use_growth_lead_id: /\.not\("growth_lead_id", "is", null\)/.test(index),
    repos_no_lead_inbox_id: ![searchRepo, buyingRepo, companyRepo].some((src) => /lead_inbox_id/.test(src)),
  }
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const staticChecks = runStaticChecks()

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          qa_marker: GE_LEADS_CANONICAL_INTELLIGENCE_FK_4C_QA_MARKER,
          error: "production_bootstrap_failed",
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const columnProbes = Object.fromEntries(
    await Promise.all(
      INTELLIGENCE_TABLES.map(async (table) => [table, await probeGrowthLeadIdColumn(boot.admin, table)]),
    ),
  ) as Record<(typeof INTELLIGENCE_TABLES)[number], boolean>

  const leadInboxDropped = await verifyLeadInboxTableDropped(boot.admin)

  const [canonicalQueue] = await Promise.all([
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", limit: 200 }),
  ])

  const certification = {
    qa_marker: GE_LEADS_CANONICAL_INTELLIGENCE_FK_4C_QA_MARKER,
    env_source: boot.env_source,
    supabase_host: new URL(boot.url).host,
    no_env_local: !fs.existsSync(path.join(process.cwd(), ".env.local")),
    static: staticChecks,
    production_schema: {
      growth_lead_id_columns: columnProbes,
      all_columns_present: Object.values(columnProbes).every(Boolean),
    },
    production_read_only: {
      lead_inbox_table_dropped: leadInboxDropped,
      canonical_queue_total: canonicalQueue.total,
    },
    revenue_queue_unchanged:
      canonicalQueue.queue_source === "canonical" && canonicalQueue.total >= 23,
    all_static_pass: Object.values(staticChecks).every(Boolean),
  }

  console.log(JSON.stringify(certification, null, 2))

  const failed =
    !certification.all_static_pass ||
    !certification.production_schema.all_columns_present ||
    !leadInboxDropped ||
    !certification.revenue_queue_unchanged

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
