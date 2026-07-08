/**
 * GE-LEADS-CANONICAL-4E — Dead code removal + schema drop readiness (superseded by 4F after drop).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-dead-code-drop-readiness-4e.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadRevenueQueueDashboardPayload } from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import type { SupabaseClient } from "@supabase/supabase-js"

export const GE_LEADS_CANONICAL_DEAD_CODE_DROP_READINESS_4E_QA_MARKER =
  "GE-LEADS-CANONICAL-4E-DEAD-CODE-DROP-READINESS" as const

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

function scanLibForLeadInboxTableAccess(): {
  read_hits: string[]
  write_hits: string[]
} {
  const libRoot = path.join(process.cwd(), "lib")
  const readHits: string[] = []
  const writeHits: string[] = []
  const fromInbox = /\.from\(["']lead_inbox["']\)/

  for (const file of listLibTsFiles(libRoot)) {
    const source = fs.readFileSync(file, "utf8")
    if (!fromInbox.test(source)) continue
    const rel = path.relative(process.cwd(), file)
    if (/\.(insert|update|upsert|delete)\(/.test(source)) writeHits.push(rel)
    else readHits.push(rel)
  }

  return { read_hits: readHits, write_hits: writeHits }
}

async function verifyLeadInboxTableDropped(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("lead_inbox").select("id").limit(1)
  return Boolean(error?.message?.includes("does not exist") || error?.code === "PGRST205")
}

function runStaticChecks(): Record<string, boolean> {
  const repo = readSource("lib/growth/lead-inbox/lead-inbox-repository.ts")
  const bridge = readSource("lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts")
  const handoff = readSource("lib/growth/operator-handoff/operator-handoff-repository.ts")
  const projectionCert = readSource("lib/growth/revenue-queue/revenue-queue-projection-cert.ts")
  const libScan = scanLibForLeadInboxTableAccess()
  const dropMigration = readSource(
    "supabase/migrations/20270936120000_growth_engine_drop_legacy_lead_inbox_4f.sql",
  )

  return {
    repo_no_load_lead_inbox: !/export async function loadLeadInbox/.test(repo),
    repo_no_claim_lead: !/export async function claimLead/.test(repo),
    repo_no_inbox_insert: !/\.from\(["']lead_inbox["']\)[\s\S]*?\.insert\(/.test(repo),
    bridge_no_inbox_query: !/\.from\(["']lead_inbox["']\)/.test(bridge),
    handoff_no_inbox_query: !/\.from\(["']lead_inbox["']\)/.test(handoff),
    projection_cert_no_load_lead_inbox: !/loadLeadInbox/.test(projectionCert),
    lib_no_runtime_lead_inbox_reads: libScan.read_hits.length === 0,
    lib_no_runtime_lead_inbox_writes: libScan.write_hits.length === 0,
    drop_migration_4f_exists: dropMigration.length > 0,
    schema_health_removed: !fs.existsSync(
      path.join(process.cwd(), "lib/growth/lead-inbox/lead-inbox-schema-health.ts"),
    ),
  }
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const staticChecks = runStaticChecks()
  const libScan = scanLibForLeadInboxTableAccess()

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          qa_marker: GE_LEADS_CANONICAL_DEAD_CODE_DROP_READINESS_4E_QA_MARKER,
          error: "production_bootstrap_failed",
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const [leadInboxDropped, queue] = await Promise.all([
    verifyLeadInboxTableDropped(boot.admin),
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", limit: 200 }),
  ])

  const certification = {
    qa_marker: GE_LEADS_CANONICAL_DEAD_CODE_DROP_READINESS_4E_QA_MARKER,
    env_source: boot.env_source,
    supabase_host: new URL(boot.url).host,
    no_env_local: !fs.existsSync(path.join(process.cwd(), ".env.local")),
    static: staticChecks,
    lib_lead_inbox_table_scan: libScan,
    production_read_only: {
      lead_inbox_table_dropped: leadInboxDropped,
      canonical_queue_source: queue.queue_source,
      canonical_queue_total: queue.total,
      canonical_card_count: queue.sections.reduce((sum, section) => sum + section.items.length, 0),
    },
    revenue_queue_unchanged: queue.queue_source === "canonical" && queue.total >= 23,
    all_static_pass: Object.values(staticChecks).every(Boolean),
    superseded_by: "GE-LEADS-CANONICAL-4F-SCHEMA-DROP",
    no_commit: true,
    no_push: true,
    no_deploy: true,
  }

  console.log(JSON.stringify(certification, null, 2))

  const failed =
    !certification.all_static_pass ||
    !leadInboxDropped ||
    !certification.revenue_queue_unchanged

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
