/**
 * GE-LEADS-CANONICAL-4B — Canonical intake cutover certification (production read-only + static gates).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-intake-cutover-4b.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  loadRevenueQueueDashboardPayload,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import type { SupabaseClient } from "@supabase/supabase-js"

export const GE_LEADS_CANONICAL_INTAKE_CUTOVER_4B_QA_MARKER =
  "GE-LEADS-CANONICAL-4B-INTAKE-CUTOVER" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function extractCreateLeadCandidateBody(repoSource: string): string {
  const start = repoSource.indexOf("export async function createLeadCandidate")
  if (start < 0) return ""
  return repoSource.slice(start)
}

async function verifyLeadInboxTableDropped(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("lead_inbox").select("id").limit(1)
  return Boolean(error?.message?.includes("does not exist") || error?.code === "PGRST205")
}

function runStaticChecks(): Record<string, boolean> {
  const repoSource = readSource("lib/growth/lead-inbox/lead-inbox-repository.ts")
  const createBody = extractCreateLeadCandidateBody(repoSource)
  const loaderSource = readSource("lib/growth/lead-inbox/lead-inbox-loader.ts")
  const pushSource = readSource("lib/growth/prospect-search/prospect-search-push-to-inbox.ts")
  const indexSource = readSource("lib/growth/prospect-search/prospect-search-index.ts")
  const intentHandoffSource = readSource("lib/growth/intent-pixel/process-recent-intent-handoff.ts")
  const audienceSource = readSource("lib/growth/audiences/growth-audience-lead-creation-service.ts")
  const bridgeSource = readSource("lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts")

  return {
    create_lead_candidate_no_inbox_insert:
      createBody.length > 0 &&
      !/\.from\(["']lead_inbox["']\)[\s\S]*?\.insert\(/.test(createBody),
    create_lead_candidate_returns_growth_lead_id: /growth_lead_id: canonical\.growth_lead_id/.test(
      createBody,
    ),
    create_lead_candidate_cutover_marker: /GROWTH_LEAD_INBOX_CANONICAL_INTAKE_CUTOVER_QA_MARKER/.test(
      createBody,
    ),
    intent_loader_uses_create_lead_candidate: /createLeadCandidate\(/.test(loaderSource),
    intent_loader_persists_growth_lead_id: /growth_lead_id: growthLeadId/.test(loaderSource),
    intent_loader_no_lead_inbox_id_writes: !/lead_inbox_id/.test(loaderSource),
    prospect_push_succeeds_on_growth_lead_id:
      /growth_lead_id/.test(pushSource) && /Revenue Queue/.test(pushSource),
    prospect_index_no_lead_inbox_table_query: !/\.from\(["']lead_inbox["']\)/.test(indexSource),
    intent_recent_handoff_uses_growth_lead_id:
      /ingest\.growth_lead_id/.test(intentHandoffSource) &&
      !/ingest\.row/.test(intentHandoffSource),
    audience_uses_create_lead_candidate: /createLeadCandidate\(/.test(audienceSource),
    bridge_resolve_unified: /resolveUnifiedLeadFromIntake\(/.test(bridgeSource),
    dedupe_queries_growth_leads: /\.from\(["']leads["']\)/.test(
      readSource("lib/growth/lead-inbox/lead-inbox-dedupe.ts"),
    ),
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
          qa_marker: GE_LEADS_CANONICAL_INTAKE_CUTOVER_4B_QA_MARKER,
          error: "production_bootstrap_failed",
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const leadInboxDropped = await verifyLeadInboxTableDropped(boot.admin)

  const [canonicalQueue] = await Promise.all([
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", limit: 200 }),
  ])

  const certification = {
    qa_marker: GE_LEADS_CANONICAL_INTAKE_CUTOVER_4B_QA_MARKER,
    env_source: boot.env_source,
    supabase_host: new URL(boot.url).host,
    no_env_local: !fs.existsSync(path.join(process.cwd(), ".env.local")),
    static: staticChecks,
    production_read_only: {
      lead_inbox_table_dropped: leadInboxDropped,
      canonical_queue_source: canonicalQueue.queue_source,
      canonical_queue_total: canonicalQueue.total,
    },
    intake_paths: {
      prospect_search: staticChecks.prospect_push_succeeds_on_growth_lead_id,
      intent_pixel: staticChecks.intent_recent_handoff_uses_growth_lead_id,
      dynamic_audience: staticChecks.audience_uses_create_lead_candidate,
      create_lead_candidate: staticChecks.create_lead_candidate_no_inbox_insert,
    },
    revenue_queue_unchanged:
      canonicalQueue.queue_source === "canonical" &&
      canonicalQueue.total >= 23,
    all_static_pass: Object.values(staticChecks).every(Boolean),
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
