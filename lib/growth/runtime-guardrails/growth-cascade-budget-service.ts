import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createCascadeBudgetCounters,
  evaluateCascadeBudget,
  incrementCascadeNotification,
  incrementCascadeWakeEvaluation,
  incrementCascadeWrite,
  type CascadeBudgetCounters,
} from "@/lib/growth/runtime-guardrails/growth-cascade-budget"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

function cascadeTable(admin: SupabaseClient) {
  return admin.schema("growth").from("runtime_cascade_budgets")
}

export class GrowthCascadeBudgetTracker {
  private counters = createCascadeBudgetCounters()
  private stopped = false

  constructor(
    private readonly admin: SupabaseClient,
    private readonly eventId: string,
    private readonly organizationId?: string | null,
  ) {}

  get isStopped(): boolean {
    return this.stopped
  }

  get snapshot(): CascadeBudgetCounters {
    return { ...this.counters }
  }

  recordWrite(volume = 1): boolean {
    if (this.stopped) return false
    this.counters = incrementCascadeWrite(this.counters, volume)
    return this.checkAndMaybeStop("write")
  }

  recordNotification(volume = 1): boolean {
    if (this.stopped) return false
    this.counters = incrementCascadeNotification(this.counters, volume)
    return this.checkAndMaybeStop("notification")
  }

  recordWakeEvaluation(volume = 1): boolean {
    if (this.stopped) return false
    this.counters = incrementCascadeWakeEvaluation(this.counters, volume)
    return this.checkAndMaybeStop("wake_evaluation")
  }

  private checkAndMaybeStop(kind: string): boolean {
    const evaluation = evaluateCascadeBudget(this.counters)
    if (!evaluation.allowed) {
      this.stopped = true
      void this.persistExceeded(kind, evaluation.reason)
      return false
    }
    return true
  }

  private async persistExceeded(kind: string, reason: string | null): Promise<void> {
    const enforcement = await isRuntimeKillSwitchEnabled(
      this.admin,
      "cascade_budget_enforcement_enabled",
    )
    if (!enforcement) return

    await cascadeTable(this.admin).upsert(
      {
        event_id: this.eventId,
        organization_id: this.organizationId ?? null,
        writes_generated: this.counters.writesGenerated,
        notifications_generated: this.counters.notificationsGenerated,
        wake_evaluations_generated: this.counters.wakeEvaluationsGenerated,
        budget_exceeded: true,
        stopped_at: new Date().toISOString(),
        qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    )

    await recordRuntimeGuardrailAudit(this.admin, {
      organizationId: this.organizationId,
      resourceType: "event_side_effects",
      severity: "warning",
      message: reason ?? "Cascade budget exceeded.",
      context: { eventId: this.eventId, kind, counters: this.counters },
    })
  }

  async flush(): Promise<void> {
    if (this.stopped) return
    await cascadeTable(this.admin).upsert(
      {
        event_id: this.eventId,
        organization_id: this.organizationId ?? null,
        writes_generated: this.counters.writesGenerated,
        notifications_generated: this.counters.notificationsGenerated,
        wake_evaluations_generated: this.counters.wakeEvaluationsGenerated,
        budget_exceeded: false,
        qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    )
  }
}

export async function createCascadeBudgetTracker(
  admin: SupabaseClient,
  input: { eventId: string; organizationId?: string | null },
): Promise<GrowthCascadeBudgetTracker> {
  return new GrowthCascadeBudgetTracker(admin, input.eventId, input.organizationId)
}
