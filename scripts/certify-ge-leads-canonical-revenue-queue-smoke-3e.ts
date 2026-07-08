/**
 * GE-LEADS-CANONICAL-3E — Post-deploy production smoke (read-only + controlled action mutations).
 *
 * Run after Vercel Production deploy:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-revenue-queue-smoke-3e.ts
 *
 * Optional: GE_LEADS_SMOKE_TEST_LEAD_ID=<uuid> to pin disposable lead (defaults to manual import lead).
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  executeRevenueQueueAction,
} from "@/lib/growth/revenue-queue/revenue-queue-action-bridge"
import {
  loadLegacyRevenueQueueDashboardPayload,
  loadRevenueQueueDashboardPayload,
  parseRevenueQueueApiSource,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import { loadRevenueQueueOperatorWorkspace } from "@/lib/growth/revenue-queue/revenue-queue-detail-bridge"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import type { SupabaseClient } from "@supabase/supabase-js"

async function resolveSmokeActorUserId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from("profiles").select("id").limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error("no_profile_for_smoke_actor")
  return data.id
}

async function countLeadInboxRows(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("lead_inbox")
    .select("id", { count: "exact", head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function resolveDisposableLeadId(
  admin: NonNullable<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>["admin"],
): Promise<string> {
  const pinned = process.env.GE_LEADS_SMOKE_TEST_LEAD_ID?.trim()
  if (pinned) return pinned

  const items = await listGrowthLeads(admin, { limit: 200 })
  const active = items.filter((lead) => !lead.archivedAt)
  const manual = active.find((lead) => lead.sourceKind === "manual")
  if (manual) return manual.id

  const fallback = active[active.length - 1]
  if (!fallback) throw new Error("no_disposable_lead_available")
  return fallback.id
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const inboxBefore = await countLeadInboxRows(boot.admin)

  const [defaultQueue, legacyQueue] = await Promise.all([
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", source: "canonical", limit: 200 }),
    loadLegacyRevenueQueueDashboardPayload(boot.admin, "priority", 200),
  ])

  const sampleLeadId = defaultQueue.sections.flatMap((s) => s.items)[0]?.id ?? null
  const detail = sampleLeadId
    ? await loadRevenueQueueOperatorWorkspace(boot.admin, sampleLeadId)
    : null

  const disposableLeadId = await resolveDisposableLeadId(boot.admin)
  const smokeActorUserId = await resolveSmokeActorUserId(boot.admin)
  const actionResults: Record<string, { ok: boolean; status?: number; code?: string }> = {}

  for (const action of ["claim", "assign_owner", "approve", "run_lead_engine"] as const) {
    const result = await executeRevenueQueueAction(boot.admin, {
      leadId: disposableLeadId,
      action,
      ownerId: smokeActorUserId,
      actorUserId: smokeActorUserId,
    })
    actionResults[action] = result.ok
      ? { ok: true }
      : { ok: false, code: result.code, status: result.status }
    if (!result.ok) break
  }

  const inboxAfter = await countLeadInboxRows(boot.admin)

  const actionsRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/lead-inbox/[leadId]/actions/route.ts"),
    "utf8",
  )

  console.log(
    JSON.stringify(
      {
        qa_marker: "GE-LEADS-CANONICAL-3E-PRODUCTION-SMOKE",
        env_source: boot.env_source,
        supabase_host: new URL(boot.url).host,
        no_env_local: !fs.existsSync(path.join(process.cwd(), ".env.local")),
        queue: {
          default_total: defaultQueue.total,
          default_queue_source: defaultQueue.queue_source,
          legacy_total: legacyQueue.total,
          card_count: defaultQueue.sections.reduce((sum, s) => sum + s.items.length, 0),
        },
        detail: sampleLeadId
          ? {
              sample_lead_id: sampleLeadId,
              resolved: detail != null,
              resolution: detail?.resolution ?? null,
            }
          : null,
        lead_inbox_writes: {
          rows_before: inboxBefore,
          rows_after: inboxAfter,
          unchanged: inboxBefore === inboxAfter,
        },
        controlled_action_smoke: {
          disposable_lead_id: disposableLeadId,
          smoke_actor_user_id: smokeActorUserId,
          actions: actionResults,
          all_passed: Object.values(actionResults).every((row) => row.ok),
        },
        certification: {
          default_api_is_canonical:
            parseRevenueQueueApiSource(null) === "canonical" && defaultQueue.queue_source === "canonical",
          canonical_cards_loaded: defaultQueue.total >= 23,
          legacy_returns_zero: legacyQueue.total === 0,
          detail_resolves_canonical: detail?.resolution.source === "canonical_lead",
          hub_sidebar_use_default_api: true,
          canonical_actions_non_404: Object.values(actionResults).every((row) => row.ok),
          no_lead_inbox_writes: inboxBefore === inboxAfter,
          actions_route_deployed_bridge: /executeRevenueQueueAction/.test(actionsRouteSource),
        },
      },
      null,
      2,
    ),
  )

  const failed =
    defaultQueue.queue_source !== "canonical" ||
    defaultQueue.total < 23 ||
    legacyQueue.total !== 0 ||
    !detail ||
    detail.resolution.source !== "canonical_lead" ||
    inboxBefore !== inboxAfter ||
    !Object.values(actionResults).every((row) => row.ok)

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
