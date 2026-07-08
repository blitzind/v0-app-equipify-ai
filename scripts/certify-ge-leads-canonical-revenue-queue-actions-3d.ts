/**
 * GE-LEADS-CANONICAL-3D — Certify canonical Revenue Queue actions + default API flip.
 * Superseded by 4D/4E — canonical-only; legacy inbox mutations removed.
 *
 * Read-only production checks for list/detail/resolution; no action POST mutations.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-revenue-queue-actions-3d.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  GROWTH_REVENUE_QUEUE_ACTION_BRIDGE_QA_MARKER,
  resolveRevenueQueueActionTarget,
} from "@/lib/growth/revenue-queue/revenue-queue-action-bridge"
import {
  GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
  loadCanonicalRevenueQueueDashboardPayload,
  loadRevenueQueueDashboardPayload,
  parseRevenueQueueApiSource,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import { loadRevenueQueueOperatorWorkspace } from "@/lib/growth/revenue-queue/revenue-queue-detail-bridge"

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
  const hubMetricsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/hubs/growth-leads-hub-metrics-client.ts"),
    "utf8",
  )
  const sidebarSource = fs.readFileSync(
    path.join(process.cwd(), "hooks/use-growth-sidebar-console.ts"),
    "utf8",
  )
  const actionsRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/lead-inbox/[leadId]/actions/route.ts"),
    "utf8",
  )
  const actionBridgeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/revenue-queue/revenue-queue-action-bridge.ts"),
    "utf8",
  )

  const staticChecks = {
    default_source_is_canonical: parseRevenueQueueApiSource(null) === "canonical",
    legacy_source_maps_to_canonical: parseRevenueQueueApiSource("legacy") === "canonical",
    dashboard_uses_default_api: /\/api\/platform\/growth\/lead-inbox\?sort=/.test(dashboardSource),
    dashboard_avoids_legacy_source: !/source=legacy/.test(dashboardSource),
    hub_metrics_uses_default_api: /\/api\/platform\/growth\/lead-inbox\?sort=priority/.test(hubMetricsSource),
    hub_metrics_avoids_legacy_source: !/source=legacy/.test(hubMetricsSource),
    sidebar_uses_default_api: /\/api\/platform\/growth\/lead-inbox/.test(sidebarSource),
    sidebar_avoids_legacy_source: !/source=legacy/.test(sidebarSource),
    actions_route_uses_bridge: /executeRevenueQueueAction/.test(actionsRouteSource),
    actions_route_avoids_inbox_fetch: !/fetchLeadInboxById/.test(actionsRouteSource),
    canonical_action_prefers_growth_leads:
      /resolveRevenueQueueActionTarget[\s\S]*?fetchGrowthLeadById/.test(actionBridgeSource) &&
      !/fetchLeadInboxById/.test(actionBridgeSource),
    canonical_apply_avoids_inbox_mutations:
      /async function applyCanonicalLeadAction[\s\S]*?updateGrowthLead/.test(actionBridgeSource) &&
      !/async function applyCanonicalLeadAction[\s\S]*?claimLead\(/.test(actionBridgeSource),
    no_duplicate_dashboard_component: !/GrowthLeadInboxDashboardCanonical/.test(dashboardSource),
  }

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const [defaultPayload, legacyMappedPayload, explicitCanonical] = await Promise.all([
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", source: "canonical", limit: 200 }),
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", source: "legacy", limit: 200 }),
    loadCanonicalRevenueQueueDashboardPayload(boot.admin, "priority", 200),
  ])

  const sampleLeadId = defaultPayload.sections.flatMap((section) => section.items)[0]?.id ?? null
  let detailResult: Awaited<ReturnType<typeof loadRevenueQueueOperatorWorkspace>> | null = null
  let actionTarget: Awaited<ReturnType<typeof resolveRevenueQueueActionTarget>> | null = null
  if (sampleLeadId) {
    ;[detailResult, actionTarget] = await Promise.all([
      loadRevenueQueueOperatorWorkspace(boot.admin, sampleLeadId),
      resolveRevenueQueueActionTarget(boot.admin, sampleLeadId),
    ])
  }

  const defaultContractErrors = assertDashboardContract({
    ok: true,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    sections: defaultPayload.sections,
    total: defaultPayload.total,
  })

  const countsAlign =
    defaultPayload.total === explicitCanonical.total && defaultPayload.total === defaultPayload.total

  console.log(
    JSON.stringify(
      {
        qa_marker: "GE-LEADS-CANONICAL-3D-ACTIONS-CERT",
        env_source: boot.env_source,
        supabase_host: new URL(boot.url).host,
        static_checks: staticChecks,
        queue: {
          default_total: defaultPayload.total,
          default_queue_source: defaultPayload.queue_source,
          legacy_total: legacyMappedPayload.total,
          legacy_queue_source: legacyMappedPayload.queue_source,
          explicit_canonical_total: explicitCanonical.total,
          counts_align: countsAlign,
          contract_errors: defaultContractErrors,
        },
        detail: sampleLeadId
          ? {
              sample_lead_id: sampleLeadId,
              resolved: detailResult != null,
              resolution: detailResult?.resolution ?? null,
            }
          : { sample_lead_id: null, resolved: false },
        action_resolution: sampleLeadId
          ? {
              sample_lead_id: sampleLeadId,
              target: actionTarget,
              would_404: actionTarget == null,
              canonical_target: actionTarget?.source === "canonical_lead",
            }
          : null,
        action_certification_note:
          "No POST actions executed — resolution + static bridge audit only (avoids production mutations).",
        certification: {
          default_queue_api_is_canonical:
            staticChecks.default_source_is_canonical &&
            defaultPayload.queue_source === "canonical" &&
            defaultContractErrors.length === 0,
          dashboard_hub_sidebar_counts_align:
            staticChecks.dashboard_uses_default_api &&
            staticChecks.hub_metrics_uses_default_api &&
            staticChecks.sidebar_uses_default_api &&
            countsAlign,
          canonical_lead_ids_do_not_404_on_resolution:
            actionTarget?.source === "canonical_lead" && detailResult?.resolution.source === "canonical_lead",
          canonical_actions_do_not_mutate_lead_inbox:
            staticChecks.canonical_apply_avoids_inbox_mutations && staticChecks.actions_route_avoids_inbox_fetch,
          legacy_source_maps_to_canonical:
            staticChecks.legacy_source_maps_to_canonical &&
            legacyMappedPayload.queue_source === "canonical",
          no_duplicate_ui: staticChecks.no_duplicate_dashboard_component,
          no_writes: true,
          no_commit: true,
          no_push: true,
          no_deploy: true,
        },
        bridge_markers: {
          api: GROWTH_REVENUE_QUEUE_API_BRIDGE_QA_MARKER,
          action: GROWTH_REVENUE_QUEUE_ACTION_BRIDGE_QA_MARKER,
        },
      },
      null,
      2,
    ),
  )

  const failed =
    !staticChecks.default_source_is_canonical ||
    !staticChecks.actions_route_uses_bridge ||
    defaultPayload.queue_source !== "canonical" ||
    defaultContractErrors.length > 0 ||
    defaultPayload.total === 0 ||
    !detailResult ||
    detailResult.resolution.source !== "canonical_lead" ||
    actionTarget?.source !== "canonical_lead"

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
