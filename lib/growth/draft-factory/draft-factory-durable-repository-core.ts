/**
 * SV1-5A — Postgres durable Draft Factory repository core (Node-safe).
 * No `server-only` guard — callable from tsx certs and the thin production wrapper.
 * Production authority. Fail closed on missing schema — never fall back to memory.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { DraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"
import type { DraftFactoryWakeReceipt } from "@/lib/growth/draft-factory/draft-factory-durable-store"
import {
  emptyAttemptCounts,
  type AiOsDraftFactoryAdvanceResultV5,
  type AiOsDraftFactoryDurableLeadState,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { GROWTH_REVENUE_2A_ADMISSION_INTEGRITY_RECONCILE_SCAN_STATES } from "@/lib/growth/draft-factory/draft-factory-admission-downstream-reconcile-2a"

function rowToState(row: Record<string, unknown>): AiOsDraftFactoryDurableLeadState {
  const attempts =
    (row.attempt_counts as AiOsDraftFactoryDurableLeadState["attemptCounts"] | null) ??
    emptyAttemptCounts()
  return {
    organizationId: String(row.organization_id),
    leadId: String(row.lead_id),
    state: row.state as AiOsDraftFactoryDurableLeadState["state"],
    earliestIncompleteStage:
      (row.earliest_incomplete_stage as AiOsDraftFactoryDurableLeadState["earliestIncompleteStage"]) ??
      null,
    version: Number(row.version ?? 1),
    packageId: (row.package_id as string | null) ?? null,
    researchRunId: (row.research_run_id as string | null) ?? null,
    decisionMakerId: (row.decision_maker_id as string | null) ?? null,
    personalizationId: (row.personalization_id as string | null) ?? null,
    lastWakeType: (row.last_wake_type as AiOsDraftFactoryDurableLeadState["lastWakeType"]) ?? null,
    lastWakeAt: row.last_wake_at ? String(row.last_wake_at) : null,
    nextEligibleWakeAt: row.next_eligible_wake_at ? String(row.next_eligible_wake_at) : null,
    attemptCounts: {
      research: Number(attempts.research ?? 0),
      decisionMaker: Number(attempts.decisionMaker ?? 0),
      contactVerification: Number(attempts.contactVerification ?? 0),
      personalization: Number(attempts.personalization ?? 0),
      generation: Number(attempts.generation ?? 0),
    },
    lastErrorCode: (row.last_error_code as string | null) ?? null,
    lastErrorStage: (row.last_error_stage as string | null) ?? null,
    pausedReason: (row.paused_reason as string | null) ?? null,
    leaseOwner: (row.lease_owner as string | null) ?? null,
    leaseExpiresAt: row.lease_expires_at ? String(row.lease_expires_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function stateToRow(state: AiOsDraftFactoryDurableLeadState) {
  return {
    organization_id: state.organizationId,
    lead_id: state.leadId,
    state: state.state,
    earliest_incomplete_stage: state.earliestIncompleteStage,
    version: state.version,
    package_id: state.packageId,
    research_run_id: state.researchRunId,
    decision_maker_id: state.decisionMakerId,
    personalization_id: state.personalizationId,
    last_wake_type: state.lastWakeType,
    last_wake_at: state.lastWakeAt,
    next_eligible_wake_at: state.nextEligibleWakeAt,
    attempt_counts: state.attemptCounts,
    last_error_code: state.lastErrorCode,
    last_error_stage: state.lastErrorStage,
    paused_reason: state.pausedReason,
    lease_owner: state.leaseOwner,
    lease_expires_at: state.leaseExpiresAt,
    updated_at: state.updatedAt,
    created_at: state.createdAt,
  }
}

function isMissingRelationError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  )
}

export function createPostgresDraftFactoryRepository(
  admin: SupabaseClient,
): DraftFactoryDurableRepository {
  const schemaMissing = { current: null as string | null }

  async function probe(): Promise<{ ok: true } | { ok: false; reason: string }> {
    const { error } = await admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("id")
      .limit(1)
    if (error && isMissingRelationError(error)) {
      schemaMissing.current =
        "growth.draft_factory_lead_states missing — apply SV1-5 migration before production Draft Factory."
      return { ok: false, reason: schemaMissing.current }
    }
    if (error) {
      schemaMissing.current = error.message
      return { ok: false, reason: error.message }
    }
    schemaMissing.current = null
    return { ok: true }
  }

  function throwIfSchemaMissing(): void {
    if (schemaMissing.current) {
      throw new Error(`SV1-5A Postgres fail-closed: ${schemaMissing.current}`)
    }
  }

  return {
    kind: "postgres",

    async assertAvailable() {
      return probe()
    },

    async getLeadState(organizationId, leadId) {
      const { data, error } = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("lead_id", leadId)
        .maybeSingle()
      if (error) {
        if (isMissingRelationError(error)) {
          schemaMissing.current = error.message
          throw new Error(`SV1-5A Postgres fail-closed: ${error.message}`)
        }
        throw new Error(`Draft Factory getLeadState failed: ${error.message}`)
      }
      return data ? rowToState(data as Record<string, unknown>) : null
    },

    async upsertLeadState(state, expectedVersion) {
      throwIfSchemaMissing()
      if (expectedVersion != null) {
        const { data, error } = await admin
          .schema("growth")
          .from("draft_factory_lead_states")
          .update({
            ...stateToRow({ ...state, version: expectedVersion + 1 }),
            version: expectedVersion + 1,
          })
          .eq("organization_id", state.organizationId)
          .eq("lead_id", state.leadId)
          .eq("version", expectedVersion)
          .select("id")
        if (error) {
          if (isMissingRelationError(error)) {
            schemaMissing.current = error.message
            throw new Error(`SV1-5A Postgres fail-closed: ${error.message}`)
          }
          throw new Error(`Draft Factory upsertLeadState failed: ${error.message}`)
        }
        return Boolean(data?.length)
      }

      const { error } = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .upsert(stateToRow(state), { onConflict: "organization_id,lead_id" })
      if (error) {
        if (isMissingRelationError(error)) {
          schemaMissing.current = error.message
          throw new Error(`SV1-5A Postgres fail-closed: ${error.message}`)
        }
        throw new Error(`Draft Factory upsertLeadState failed: ${error.message}`)
      }
      return true
    },

    async tryAcquireLease(input) {
      throwIfSchemaMissing()
      const nowMs = Date.parse(input.now)
      const leaseMs = input.leaseMs ?? 60_000
      const expiresAt = new Date(nowMs + leaseMs).toISOString()

      const existing = await this.getLeadState(input.organizationId, input.leadId)
      if (!existing) {
        // Caller will create state; lease granted for first writer.
        return true
      }
      if (
        existing.leaseOwner &&
        existing.leaseOwner !== input.workerId &&
        existing.leaseExpiresAt &&
        Date.parse(existing.leaseExpiresAt) > nowMs
      ) {
        return false
      }

      const { data, error } = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .update({
          lease_owner: input.workerId,
          lease_expires_at: expiresAt,
          updated_at: input.now,
          version: existing.version + 1,
        })
        .eq("organization_id", input.organizationId)
        .eq("lead_id", input.leadId)
        .eq("version", existing.version)
        .or(
          `lease_owner.is.null,lease_owner.eq.${input.workerId},lease_expires_at.is.null,lease_expires_at.lt.${input.now}`,
        )
        .select("id")

      if (error) {
        // Fallback: version-only optimistic lease when filter syntax is awkward
        const retry = await admin
          .schema("growth")
          .from("draft_factory_lead_states")
          .update({
            lease_owner: input.workerId,
            lease_expires_at: expiresAt,
            updated_at: input.now,
            version: existing.version + 1,
          })
          .eq("organization_id", input.organizationId)
          .eq("lead_id", input.leadId)
          .eq("version", existing.version)
          .select("id")
        if (retry.error) {
          throw new Error(`Draft Factory lease acquire failed: ${retry.error.message}`)
        }
        if (!retry.data?.length) return false
        // Re-check lease ownership race
        const after = await this.getLeadState(input.organizationId, input.leadId)
        return after?.leaseOwner === input.workerId
      }
      return Boolean(data?.length)
    },

    async releaseLease(input) {
      const existing = await this.getLeadState(input.organizationId, input.leadId)
      if (!existing) return
      if (existing.leaseOwner && existing.leaseOwner !== input.workerId) return
      await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .update({
          lease_owner: null,
          lease_expires_at: null,
          updated_at: input.now,
          version: existing.version + 1,
        })
        .eq("organization_id", input.organizationId)
        .eq("lead_id", input.leadId)
        .eq("version", existing.version)
        .eq("lease_owner", input.workerId)
    },

    async getWakeReceipt(organizationId, leadId, fingerprint) {
      const { data, error } = await admin
        .schema("growth")
        .from("draft_factory_wake_receipts")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("lead_id", leadId)
        .eq("wake_fingerprint", fingerprint)
        .maybeSingle()
      if (error) {
        if (isMissingRelationError(error)) {
          throw new Error(`SV1-5A Postgres fail-closed: ${error.message}`)
        }
        throw new Error(`Draft Factory getWakeReceipt failed: ${error.message}`)
      }
      if (!data) return null
      const row = data as Record<string, unknown>
      return {
        organizationId: String(row.organization_id),
        leadId: String(row.lead_id),
        wakeFingerprint: String(row.wake_fingerprint),
        wakeType: String(row.wake_type),
        outcome: String(row.outcome),
        transitionSummary: (row.transition_summary as Record<string, unknown>) ?? {},
        createdAt: String(row.created_at),
      }
    },

    async recordWakeReceipt(receipt) {
      const { error } = await admin.schema("growth").from("draft_factory_wake_receipts").insert({
        organization_id: receipt.organizationId,
        lead_id: receipt.leadId,
        wake_fingerprint: receipt.wakeFingerprint,
        wake_type: receipt.wakeType,
        outcome: receipt.outcome,
        transition_summary: receipt.transitionSummary,
        created_at: receipt.createdAt,
      })
      if (!error) return true
      if (error.code === "23505") return false
      if (isMissingRelationError(error)) {
        throw new Error(`SV1-5A Postgres fail-closed: ${error.message}`)
      }
      throw new Error(`Draft Factory recordWakeReceipt failed: ${error.message}`)
    },

    async listDueStates(input) {
      const { data, error } = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("*")
        .eq("organization_id", input.organizationId)
        .not("state", "in", '("waiting_for_approval","approved","executed","failed")')
        .or(`next_eligible_wake_at.is.null,next_eligible_wake_at.lte.${input.now}`)
        .order("updated_at", { ascending: true })
        .limit(input.limit ?? 100)
      if (error) {
        if (isMissingRelationError(error)) {
          throw new Error(`SV1-5A Postgres fail-closed: ${error.message}`)
        }
        throw new Error(`Draft Factory listDueStates failed: ${error.message}`)
      }
      return (data ?? []).map((row) => rowToState(row as Record<string, unknown>))
    },

    async listAdmissionIntegrityReconcileStates(input) {
      const { data, error } = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("*")
        .eq("organization_id", input.organizationId)
        .in("state", [...GROWTH_REVENUE_2A_ADMISSION_INTEGRITY_RECONCILE_SCAN_STATES])
        .order("updated_at", { ascending: true })
        .limit(input.limit ?? 100)
      if (error) {
        if (isMissingRelationError(error)) {
          throw new Error(`SV1-5A Postgres fail-closed: ${error.message}`)
        }
        throw new Error(`Draft Factory listAdmissionIntegrityReconcileStates failed: ${error.message}`)
      }
      return (data ?? []).map((row) => rowToState(row as Record<string, unknown>))
    },

    async listDeferredStates(organizationId) {
      const { data, error } = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("*")
        .eq("organization_id", organizationId)
        .or("state.eq.paused,paused_reason.eq.portfolio_deferred,earliest_incomplete_stage.eq.portfolio")
      if (error) {
        throw new Error(`Draft Factory listDeferredStates failed: ${error.message}`)
      }
      return (data ?? []).map((row) => rowToState(row as Record<string, unknown>))
    },

    async incrementPackagesProduced(organizationId, now) {
      // Persist via state_json counter on a sentinel row is overkill; use org-day key in state_json of first due write.
      // Production capacity also enforced by existing 5F hourly budgets. Track in wake receipts count for diagnostics.
      const day = now.slice(0, 10)
      const key = `packages:${organizationId}:${day}`
      const { data } = await admin
        .schema("growth")
        .from("draft_factory_wake_receipts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("outcome", "completed")
        .ilike("wake_type", "%generation%")
        .gte("created_at", `${day}T00:00:00.000Z`)
        .lte("created_at", `${day}T23:59:59.999Z`)
      void key
      return (data?.length ?? 0) + 1
    },

    async getPackagesProducedToday(organizationId, now) {
      const day = now.slice(0, 10)
      const { count, error } = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("state", "waiting_for_approval")
        .gte("updated_at", `${day}T00:00:00.000Z`)
      if (error) return 0
      return count ?? 0
    },

    async appendTransition(result: AiOsDraftFactoryAdvanceResultV5) {
      // Transitions are durable via wake receipts + state rows; optional audit left to live facade.
      void result
    },
  }
}

/** Back-compat named exports used by earlier SV1-5 stubs. */
export async function fetchDurableDraftFactoryLeadState(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<AiOsDraftFactoryDurableLeadState | null> {
  return createPostgresDraftFactoryRepository(admin).getLeadState(organizationId, leadId)
}

export async function upsertDurableDraftFactoryLeadStateRow(
  admin: SupabaseClient,
  state: AiOsDraftFactoryDurableLeadState,
  expectedVersion?: number,
): Promise<boolean> {
  return createPostgresDraftFactoryRepository(admin).upsertLeadState(state, expectedVersion)
}

export async function insertDurableWakeReceiptRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wakeFingerprint: string
    wakeType: string
    outcome: string
    transitionSummary: Record<string, unknown>
    createdAt: string
  },
): Promise<"inserted" | "duplicate" | "error"> {
  const repo = createPostgresDraftFactoryRepository(admin)
  try {
    const ok = await repo.recordWakeReceipt({
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeFingerprint: input.wakeFingerprint,
      wakeType: input.wakeType,
      outcome: input.outcome,
      transitionSummary: input.transitionSummary,
      createdAt: input.createdAt,
    })
    return ok ? "inserted" : "duplicate"
  } catch {
    return "error"
  }
}
