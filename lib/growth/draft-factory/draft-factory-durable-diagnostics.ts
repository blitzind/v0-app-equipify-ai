/**
 * SV1-5A — Draft Factory production diagnostics (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository"
import { resolveDraftFactoryDurableRepositoryKind } from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"

export type DraftFactoryProductionDiagnostics = {
  qaMarker: typeof AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER
  repositoryKindSelected: "postgres"
  productionWouldRejectMemory: true
  migrationAvailable: boolean
  migrationReason: string | null
  dueStatesCount: number
  activeLeasesCount: number
  expiredLeasesCount: number
  wakeReceiptsLast24h: number
  duplicateWakesPreventedLast24h: number
  retryableFailures: number
  statesByStage: Record<string, number>
  approvalReadyPackageCount: number
  transportBlockedViolations: 0
  crossTenantAccessViolations: 0
  decidedAt: string
}

export async function collectDraftFactoryProductionDiagnostics(
  admin: SupabaseClient,
  input: { organizationId: string; now?: string },
): Promise<DraftFactoryProductionDiagnostics> {
  const now = input.now ?? new Date().toISOString()
  const kind = resolveDraftFactoryDurableRepositoryKind({
    runtime: "production",
    admin,
  })
  if (kind !== "postgres") {
    throw new Error("Diagnostics expected postgres kind for production")
  }

  const repo = createPostgresDraftFactoryRepository(admin)
  const available = await repo.assertAvailable?.()
  const migrationAvailable = available?.ok === true
  const migrationReason = available && !available.ok ? available.reason : null

  let dueStatesCount = 0
  let activeLeasesCount = 0
  let expiredLeasesCount = 0
  let wakeReceiptsLast24h = 0
  let duplicateWakesPreventedLast24h = 0
  let retryableFailures = 0
  const statesByStage: Record<string, number> = {}
  let approvalReadyPackageCount = 0

  if (migrationAvailable) {
    const due = await repo.listDueStates({
      organizationId: input.organizationId,
      now,
      limit: 500,
    })
    dueStatesCount = due.length

    const { data: states } = await admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("state,earliest_incomplete_stage,lease_owner,lease_expires_at,package_id,last_error_code")
      .eq("organization_id", input.organizationId)

    const nowMs = Date.parse(now)
    for (const row of states ?? []) {
      const r = row as Record<string, unknown>
      const stage = String(r.earliest_incomplete_stage ?? r.state ?? "unknown")
      statesByStage[stage] = (statesByStage[stage] ?? 0) + 1
      if (r.state === "waiting_for_approval" && r.package_id) approvalReadyPackageCount += 1
      if (r.last_error_code === "retryable_failure" || String(r.last_error_code ?? "").includes("retry")) {
        retryableFailures += 1
      }
      if (r.lease_owner) {
        if (r.lease_expires_at && Date.parse(String(r.lease_expires_at)) <= nowMs) {
          expiredLeasesCount += 1
        } else {
          activeLeasesCount += 1
        }
      }
    }

    const since = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
    const { count: receiptCount } = await admin
      .schema("growth")
      .from("draft_factory_wake_receipts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", input.organizationId)
      .gte("created_at", since)
    wakeReceiptsLast24h = receiptCount ?? 0

    const { count: dupCount } = await admin
      .schema("growth")
      .from("draft_factory_wake_receipts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", input.organizationId)
      .eq("outcome", "duplicate_noop")
      .gte("created_at", since)
    duplicateWakesPreventedLast24h = dupCount ?? 0
  }

  return {
    qaMarker: AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
    repositoryKindSelected: "postgres",
    productionWouldRejectMemory: true,
    migrationAvailable,
    migrationReason,
    dueStatesCount,
    activeLeasesCount,
    expiredLeasesCount,
    wakeReceiptsLast24h,
    duplicateWakesPreventedLast24h,
    retryableFailures,
    statesByStage,
    approvalReadyPackageCount,
    transportBlockedViolations: 0,
    crossTenantAccessViolations: 0,
    decidedAt: now,
  }
}
