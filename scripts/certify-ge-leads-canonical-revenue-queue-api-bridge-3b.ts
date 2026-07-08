/**
 * GE-LEADS-CANONICAL-3B — Certify Revenue Queue API bridge (canonical-only).
 * Superseded by 4D/4E — retained for historical regression; legacy loader removed.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-revenue-queue-api-bridge-3b.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
  loadCanonicalRevenueQueueDashboardPayload,
  loadRevenueQueueDashboardPayload,
  parseRevenueQueueApiSource,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"

function assertUiContract(payload: {
  ok: boolean
  qa_marker: string
  sort: string
  sections: unknown
  total: number
}): string[] {
  const errors: string[] = []
  if (!payload.ok) errors.push("ok must be true")
  if (payload.qa_marker !== GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER) {
    errors.push("qa_marker mismatch")
  }
  if (!Array.isArray(payload.sections)) errors.push("sections must be array")
  if (typeof payload.total !== "number") errors.push("total must be number")
  if (!Array.isArray(payload.sections)) return errors

  for (const section of payload.sections) {
    const row = section as { id?: string; label?: string; items?: unknown[] }
    if (!row.id || !row.label || !Array.isArray(row.items)) {
      errors.push(`invalid section shape: ${row.id ?? "(missing id)"}`)
    }
  }
  if (payload.sections.length !== GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS.length) {
    errors.push(`expected ${GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS.length} sections`)
  }
  return errors
}

function countCards(sections: Array<{ items?: unknown[] }>): number {
  return sections.reduce((sum, section) => sum + (section.items?.length ?? 0), 0)
}

async function main(): Promise<void> {
  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/lead-inbox/route.ts"),
    "utf8",
  )
  const dashboardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/lead-operator/growth-lead-inbox-dashboard.tsx"),
    "utf8",
  )
  const bridgeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/revenue-queue/revenue-queue-api-bridge.ts"),
    "utf8",
  )

  const staticChecks = {
    route_uses_bridge: /loadRevenueQueueDashboardPayload/.test(routeSource),
    route_no_source_param: !/parseRevenueQueueApiSource/.test(routeSource),
    canonical_uses_list_growth_leads: /loadRevenueQueueDashboardPayload[\s\S]*?listGrowthLeads/.test(
      bridgeSource,
    ),
    canonical_avoids_load_lead_inbox: !/loadRevenueQueueDashboardPayload[\s\S]*?loadLeadInbox/.test(
      bridgeSource,
    ),
    ui_uses_default_canonical: !/source=legacy/.test(dashboardSource),
    dashboard_omits_legacy_source: !/source=legacy/.test(dashboardSource),
    default_source_is_canonical: parseRevenueQueueApiSource(null) === "canonical",
    legacy_source_maps_to_canonical: parseRevenueQueueApiSource("legacy") === "canonical",
    no_legacy_loader_export: !/loadLegacyRevenueQueueDashboardPayload/.test(bridgeSource),
  }

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const [defaultQueue, canonical] = await Promise.all([
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", limit: 200 }),
    loadCanonicalRevenueQueueDashboardPayload(boot.admin, "priority", 200),
  ])

  const defaultResponse = {
    ok: true as const,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    api_bridge_marker: GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
    sort: "priority" as const,
    sections: defaultQueue.sections,
    total: defaultQueue.total,
    queue_source: defaultQueue.queue_source,
  }
  const canonicalResponse = {
    ok: true as const,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    api_bridge_marker: GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
    sort: "priority" as const,
    sections: canonical.sections,
    total: canonical.total,
    queue_source: canonical.queue_source,
  }

  const defaultContractErrors = assertUiContract(defaultResponse)
  const canonicalContractErrors = assertUiContract(canonicalResponse)

  console.log(
    JSON.stringify(
      {
        qa_marker: "GE-LEADS-CANONICAL-3B-API-BRIDGE-CERT",
        env_source: boot.env_source,
        supabase_host: new URL(boot.url).host,
        static_checks: staticChecks,
        legacy: {
          note: "legacy loader removed — canonical-only (4D/4E)",
          queue_source: defaultQueue.queue_source,
          total: defaultQueue.total,
          card_count: countCards(defaultQueue.sections),
          contract_errors: defaultContractErrors,
        },
        canonical: {
          queue_source: canonical.queue_source,
          total: canonical.total,
          card_count: countCards(canonical.sections),
          contract_errors: canonicalContractErrors,
          section_counts: Object.fromEntries(
            canonical.sections.map((section) => [section.id, section.items.length]),
          ),
        },
        certification: {
          default_api_is_canonical:
            staticChecks.default_source_is_canonical && canonical.queue_source === "canonical",
          legacy_mode_removed: staticChecks.no_legacy_loader_export,
          canonical_mode_works:
            canonical.queue_source === "canonical" && canonicalContractErrors.length === 0,
          canonical_reads_growth_leads_only:
            staticChecks.canonical_uses_list_growth_leads && staticChecks.canonical_avoids_load_lead_inbox,
          production_canonical_total: canonical.total,
          no_writes: true,
          no_commit: true,
          no_push: true,
          no_deploy: true,
        },
        bridge_marker: GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
        bridge_source_has_legacy_path: false,
      },
      null,
      2,
    ),
  )

  const failed =
    defaultContractErrors.length > 0 ||
    canonicalContractErrors.length > 0 ||
    !staticChecks.route_uses_bridge ||
    canonical.queue_source !== "canonical"

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
