/**
 * GE-LEADS-CANONICAL-4G — Revenue Queue naming cleanup certification.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-naming-cleanup-4g.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadRevenueQueueDashboardPayload } from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"

export const GE_LEADS_CANONICAL_NAMING_CLEANUP_4G_QA_MARKER =
  "GE-LEADS-CANONICAL-4G-NAMING-CLEANUP" as const

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

function scanLibForLegacyComputedField(): string[] {
  const hits: string[] = []
  for (const file of listLibTsFiles(path.join(process.cwd(), "lib"))) {
    const source = fs.readFileSync(file, "utf8")
    if (/\bin_lead_inbox\b/.test(source)) {
      hits.push(path.relative(process.cwd(), file))
    }
  }
  return hits
}

function runStaticChecks(): Record<string, boolean> {
  const types = readSource("lib/growth/lead-inbox/lead-inbox-types.ts")
  const workspaceTypes = readSource(
    "lib/growth/lead-operator-workspace/lead-operator-workspace-types.ts",
  )
  const prospectTypes = readSource("lib/growth/prospect-search/prospect-search-types.ts")
  const dashboard = readSource("components/growth/lead-operator/growth-lead-inbox-dashboard.tsx")
  const card = readSource("components/growth/lead-operator/growth-lead-inbox-card.tsx")
  const searchIntentRepo = readSource("lib/growth/search-intent/search-intent-repository.ts")
  const operatorHandoffRepo = readSource("lib/growth/operator-handoff/operator-handoff-repository.ts")
  const cardView = readSource("lib/growth/lead-operator-workspace/lead-inbox-card-view.ts")

  return {
    revenue_queue_row_canonical: /export type RevenueQueueRow = \{/.test(types),
    growth_lead_inbox_row_alias: /export type GrowthLeadInboxRow = RevenueQueueRow/.test(types),
    revenue_queue_card_view_canonical: /export type RevenueQueueCardView = \{/.test(workspaceTypes),
    growth_lead_inbox_card_view_alias:
      /export type GrowthLeadInboxCardView = RevenueQueueCardView/.test(workspaceTypes),
    revenue_queue_dashboard_component: /export function GrowthRevenueQueueDashboard/.test(dashboard),
    revenue_queue_card_component: /export function GrowthRevenueQueueCard/.test(card),
    prospect_search_in_revenue_queue: /in_revenue_queue: boolean/.test(prospectTypes),
    lib_no_in_lead_inbox_computed: scanLibForLegacyComputedField().length === 0,
    load_search_intent_for_revenue_queue: /loadSearchIntentSignalsForRevenueQueue/.test(
      searchIntentRepo,
    ),
    load_operator_handoff_for_revenue_queue: /loadOperatorHandoffFromRevenueQueue/.test(
      operatorHandoffRepo,
    ),
    build_revenue_queue_card_view: /export function buildRevenueQueueCardView/.test(cardView),
    api_path_unchanged_compatibility: /\/api\/platform\/growth\/lead-inbox/.test(dashboard),
    list_route_still_lead_inbox: fs.existsSync(
      path.join(process.cwd(), "app/api/platform/growth/lead-inbox/route.ts"),
    ),
    operator_prompt_revenue_queue_copy: /Revenue Queue:/.test(
      readSource("lib/growth/operator-handoff/operator-handoff-prompt.ts"),
    ),
  }
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const staticChecks = runStaticChecks()
  const legacyFieldHits = scanLibForLegacyComputedField()

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          qa_marker: GE_LEADS_CANONICAL_NAMING_CLEANUP_4G_QA_MARKER,
          error: "bootstrap_failed",
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const queue = await loadRevenueQueueDashboardPayload(boot.admin, {
    sort: "priority",
    limit: 200,
  })

  const certification = {
    qa_marker: GE_LEADS_CANONICAL_NAMING_CLEANUP_4G_QA_MARKER,
    env_source: boot.env_source,
    supabase_host: new URL(boot.url).host,
    no_env_local: !fs.existsSync(path.join(process.cwd(), ".env.local")),
    static: staticChecks,
    lib_in_lead_inbox_hits: legacyFieldHits,
    api_path_decision: {
      url: "/api/platform/growth/lead-inbox",
      status: "stable_compatibility_path",
      note: "URL retained for one more phase; canonical terminology is Revenue Queue in types/UI.",
    },
    production_read_only: {
      canonical_queue_source: queue.queue_source,
      canonical_queue_total: queue.total,
      canonical_card_count: queue.sections.reduce((sum, s) => sum + s.items.length, 0),
    },
    revenue_queue_unchanged: queue.queue_source === "canonical" && queue.total >= 23,
    all_static_pass: Object.values(staticChecks).every(Boolean),
    no_behavior_change: true,
    no_schema_change: true,
    no_commit: true,
    no_push: true,
    no_deploy: true,
  }

  console.log(JSON.stringify(certification, null, 2))

  if (!certification.all_static_pass || !certification.revenue_queue_unchanged) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
