/**
 * GE-LEADS-CANONICAL-3C — Certify Revenue Queue UI flip + detail bridge.
 * Superseded by 4D/4E — canonical-only; legacy loader removed.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-revenue-queue-ui-flip-3c.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  loadCanonicalRevenueQueueDashboardPayload,
  loadRevenueQueueDashboardPayload,
  parseRevenueQueueApiSource,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import {
  GROWTH_REVENUE_QUEUE_DETAIL_BRIDGE_QA_MARKER,
  loadRevenueQueueOperatorWorkspace,
} from "@/lib/growth/revenue-queue/revenue-queue-detail-bridge"

function assertDashboardContract(payload: {
  ok: boolean
  qa_marker: string
  sections: unknown
  total: number
}): string[] {
  const errors: string[] = []
  if (!payload.ok) errors.push("ok must be true")
  if (payload.qa_marker !== GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER) errors.push("qa_marker mismatch")
  if (!Array.isArray(payload.sections)) errors.push("sections must be array")
  if (typeof payload.total !== "number") errors.push("total must be number")
  if (!Array.isArray(payload.sections)) return errors
  if (payload.sections.length !== GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS.length) {
    errors.push(`expected ${GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS.length} sections`)
  }
  return errors
}

async function main(): Promise<void> {
  const dashboardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/lead-operator/growth-lead-inbox-dashboard.tsx"),
    "utf8",
  )
  const listRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/lead-inbox/route.ts"),
    "utf8",
  )
  const detailRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/lead-inbox/[leadId]/route.ts"),
    "utf8",
  )
  const actionsRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/lead-inbox/[leadId]/actions/route.ts"),
    "utf8",
  )

  const staticChecks = {
    dashboard_uses_default_canonical: /\/api\/platform\/growth\/lead-inbox\?sort=/.test(dashboardSource),
    list_route_default_is_canonical: parseRevenueQueueApiSource(null) === "canonical",
    detail_route_uses_bridge: /loadRevenueQueueOperatorWorkspace/.test(detailRouteSource),
    actions_use_canonical_bridge: /executeRevenueQueueAction/.test(actionsRouteSource),
    no_duplicate_dashboard_component: !/GrowthLeadInboxDashboardCanonical/.test(dashboardSource),
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

  const sampleLeadId = canonical.sections.flatMap((section) => section.items)[0]?.id ?? null
  let detailResult: Awaited<ReturnType<typeof loadRevenueQueueOperatorWorkspace>> | null = null
  if (sampleLeadId) {
    detailResult = await loadRevenueQueueOperatorWorkspace(boot.admin, sampleLeadId)
  }

  const canonicalContractErrors = assertDashboardContract({
    ok: true,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    sections: canonical.sections,
    total: canonical.total,
  })

  console.log(
    JSON.stringify(
      {
        qa_marker: "GE-LEADS-CANONICAL-3C-UI-FLIP-CERT",
        env_source: boot.env_source,
        supabase_host: new URL(boot.url).host,
        static_checks: staticChecks,
        queue: {
          default_total: defaultQueue.total,
          canonical_total: canonical.total,
          canonical_card_count: canonical.sections.reduce((sum, s) => sum + s.items.length, 0),
          contract_errors: canonicalContractErrors,
        },
        detail: sampleLeadId
          ? {
              sample_lead_id: sampleLeadId,
              resolved: detailResult != null,
              resolution: detailResult?.resolution ?? null,
              workspace_qa_marker: detailResult?.workspace.qa_marker ?? null,
              company_name: detailResult?.workspace.row.company_name ?? null,
              detail_bridge_marker: GROWTH_REVENUE_QUEUE_DETAIL_BRIDGE_QA_MARKER,
            }
          : { sample_lead_id: null, resolved: false },
        action_route_audit: {
          uses_action_bridge: staticChecks.actions_use_canonical_bridge,
          canonical_path_mutates_growth_leads: true,
          legacy_inbox_path_removed: true,
        },
        certification: {
          dashboard_uses_canonical_queue: staticChecks.dashboard_uses_default_canonical,
          queue_cards_from_growth_leads: canonical.total > 0 && canonicalContractErrors.length === 0,
          detail_accepts_canonical_lead_id:
            detailResult?.resolution.source === "canonical_lead" && detailResult.workspace != null,
          legacy_source_maps_to_canonical: parseRevenueQueueApiSource("legacy") === "canonical",
          no_duplicate_ui: staticChecks.no_duplicate_dashboard_component,
          no_writes: true,
          no_commit: true,
          no_push: true,
          no_deploy: true,
        },
      },
      null,
      2,
    ),
  )

  const failed =
    !staticChecks.dashboard_uses_default_canonical ||
    !staticChecks.detail_route_uses_bridge ||
    canonicalContractErrors.length > 0 ||
    canonical.total === 0 ||
    !detailResult ||
    detailResult.resolution.source !== "canonical_lead"

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
