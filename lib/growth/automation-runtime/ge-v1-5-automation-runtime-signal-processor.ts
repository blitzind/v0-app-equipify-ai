/** GE-v1-5 — Signal processor (main runtime entry point). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { executeGeV15PlaybookActions } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-actions"
import { evaluateGeV15Conditions } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-conditions"
import {
  getGeV15DueDelays,
  markGeV15DelayProcessed,
  scheduleGeV15Delay,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-delays"
import {
  appendGeV15RuntimeLog,
  buildGeV15ActionLogMessage,
  buildGeV15ConditionLogMessage,
  buildGeV15TriggerLogMessage,
  parseGeV15RuntimeState,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-logging"
import { matchGeV15Playbooks } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-playbooks"
import {
  GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY,
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  type GeV15SignalInput,
  type GeV15SignalProcessResult,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { consumeBudget } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-service"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

const MS_PER_DAY = 86_400_000

async function buildConditionContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    trigger: GeV15SignalInput["trigger"]
    triggerPayload?: Record<string, unknown>
    existingHasRecommendation: boolean
  },
) {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const metadata = lead?.metadata ?? {}
  const sendrIntel = metadata.sendr_intelligence as
    | { intentScore?: number; lastSendrActivityAt?: string }
    | undefined

  const inactivityDays = sendrIntel?.lastSendrActivityAt
    ? (Date.now() - Date.parse(sendrIntel.lastSendrActivityAt)) / MS_PER_DAY
    : null

  return {
    leadScore: lead?.score ?? null,
    intentScore: sendrIntel?.intentScore ?? null,
    eventCount: 1,
    inactivityDays,
    audienceIds: [],
    companyAttributes: {
      industry: lead?.industry ?? null,
      company_size: lead?.companySize ?? null,
    },
    hasActiveRecommendation: input.existingHasRecommendation,
    trigger: input.trigger,
  }
}

export async function processGeV15AutomationRuntimeSignal(
  admin: SupabaseClient,
  input: GeV15SignalInput,
): Promise<GeV15SignalProcessResult> {
  const baseResult: GeV15SignalProcessResult = {
    ok: false,
    trigger: input.trigger,
    playbooksMatched: 0,
    recommendationsCreated: 0,
    actionsPrepared: 0,
    notificationsEmitted: 0,
    tasksCreated: 0,
    delaysScheduled: 0,
    skippedReason: null,
  }

  if (!GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.runtime_enabled) {
    return { ...baseResult, skippedReason: "runtime_disabled" }
  }

  const runtimeEnabled = await isRuntimeKillSwitchEnabled(admin, "automation_runtime_enabled")
  if (!runtimeEnabled) {
    return { ...baseResult, skippedReason: "kill_switch_disabled" }
  }

  if (!GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.signal_processing_enabled) {
    return { ...baseResult, skippedReason: "signal_processing_disabled" }
  }

  const budget = await consumeBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "automation_executions",
  })
  if (!budget.allowed) {
    return { ...baseResult, skippedReason: "budget_exceeded" }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return { ...baseResult, skippedReason: "lead_not_found" }
  }

  let state = parseGeV15RuntimeState(lead.metadata)
  state = appendGeV15RuntimeLog(state, {
    phase: "trigger",
    message: buildGeV15TriggerLogMessage(input.trigger),
    trigger: input.trigger,
    metadata: input.triggerPayload,
  })

  const playbooks = matchGeV15Playbooks({
    trigger: input.trigger,
    triggerPayload: input.triggerPayload,
  })

  if (playbooks.length === 0) {
    state = {
      ...state,
      lastSignalAt: new Date().toISOString(),
      lastProcessedTrigger: input.trigger,
    }
    if (!input.dryRun) {
      await persistGeV15RuntimeState(admin, input.leadId, lead.metadata ?? {}, state)
    }
    return { ...baseResult, ok: true, skippedReason: "no_playbook_match" }
  }

  let recommendationsCreated = 0
  let actionsPrepared = 0
  let notificationsEmitted = 0
  let tasksCreated = 0
  let delaysScheduled = 0
  let playbooksMatched = 0

  for (const playbook of playbooks) {
    const conditionCtx = await buildConditionContext(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      trigger: input.trigger,
      triggerPayload: input.triggerPayload,
      existingHasRecommendation: state.recommendations.length > 0,
    })

    const conditionEval = evaluateGeV15Conditions(playbook.conditions, conditionCtx)
    state = appendGeV15RuntimeLog(state, {
      phase: "condition",
      message: buildGeV15ConditionLogMessage(conditionEval.passed, conditionEval.results),
      playbookId: playbook.id,
      trigger: input.trigger,
    })

    if (!conditionEval.passed) continue

    if (playbook.delay && playbook.delay.amount > 0) {
      const { scheduled, deduped } = scheduleGeV15Delay({
        playbookId: playbook.id,
        trigger: input.trigger,
        leadId: input.leadId,
        delay: playbook.delay,
        existing: state.pendingDelays,
      })
      if (scheduled) {
        state = {
          ...state,
          pendingDelays: [scheduled, ...state.pendingDelays].slice(0, 20),
        }
        delaysScheduled += 1
        state = appendGeV15RuntimeLog(state, {
          phase: "delay",
          message: `Delay scheduled for playbook ${playbook.id} until ${scheduled.dueAt}`,
          playbookId: playbook.id,
          trigger: input.trigger,
        })
      } else if (deduped) {
        state = appendGeV15RuntimeLog(state, {
          phase: "delay",
          message: `Delay deduped for playbook ${playbook.id}`,
          playbookId: playbook.id,
          trigger: input.trigger,
        })
      }
      continue
    }

    playbooksMatched += 1
    state = appendGeV15RuntimeLog(state, {
      phase: "trigger",
      message: buildGeV15TriggerLogMessage(input.trigger, playbook.id),
      playbookId: playbook.id,
      trigger: input.trigger,
    })

    const actionResult = await executeGeV15PlaybookActions(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      ownerUserId: input.ownerUserId,
      playbookId: playbook.id,
      trigger: input.trigger,
      actions: playbook.actions,
      state,
      dryRun: input.dryRun,
    })

    state = actionResult.state
    recommendationsCreated += actionResult.recommendationsCreated
    actionsPrepared += actionResult.actionsPrepared
    notificationsEmitted += actionResult.notificationsEmitted
    tasksCreated += actionResult.tasksCreated

    for (const spec of playbook.actions) {
      state = appendGeV15RuntimeLog(state, {
        phase: "action",
        message: buildGeV15ActionLogMessage(spec.action, spec.title),
        playbookId: playbook.id,
        trigger: input.trigger,
      })
    }
  }

  state = {
    ...state,
    lastSignalAt: new Date().toISOString(),
    lastProcessedTrigger: input.trigger,
  }

  if (!input.dryRun) {
    await persistGeV15RuntimeState(admin, input.leadId, lead.metadata ?? {}, state)
  }

  return {
    ok: true,
    trigger: input.trigger,
    playbooksMatched,
    recommendationsCreated,
    actionsPrepared,
    notificationsEmitted,
    tasksCreated,
    delaysScheduled,
    skippedReason: playbooksMatched === 0 ? "conditions_not_met" : null,
  }
}

export async function processGeV15DueDelays(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    ownerUserId?: string | null
    dryRun?: boolean
  },
): Promise<GeV15SignalProcessResult[]> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return []

  const state = parseGeV15RuntimeState(lead.metadata)
  const due = getGeV15DueDelays(state.pendingDelays)
  const results: GeV15SignalProcessResult[] = []

  for (const delay of due) {
    const result = await processGeV15AutomationRuntimeSignal(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      trigger: delay.trigger,
      ownerUserId: input.ownerUserId,
      dryRun: input.dryRun,
    })
    results.push(result)

    if (!input.dryRun && result.ok) {
      const updatedDelays = markGeV15DelayProcessed(state.pendingDelays, delay.id)
      await persistGeV15RuntimeState(admin, input.leadId, lead.metadata ?? {}, {
        ...state,
        pendingDelays: updatedDelays,
      })
    }
  }

  return results
}

async function persistGeV15RuntimeState(
  admin: SupabaseClient,
  leadId: string,
  existingMetadata: Record<string, unknown>,
  state: ReturnType<typeof parseGeV15RuntimeState>,
): Promise<void> {
  await updateGrowthLead(admin, leadId, {
    metadata: {
      ...existingMetadata,
      [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state,
    },
  })
}

export async function ingestGeV15AutomationRuntimeFromSendrEvents(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    events: Array<{ eventType: string; eventValue?: Record<string, unknown> }>
    ownerUserId?: string | null
  },
): Promise<GeV15SignalProcessResult[]> {
  const { normalizeSendrEventToGeV15Trigger } = await import(
    "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-triggers"
  )

  const results: GeV15SignalProcessResult[] = []
  for (const event of input.events) {
    const trigger = normalizeSendrEventToGeV15Trigger(event.eventType)
    if (!trigger) continue
    const result = await processGeV15AutomationRuntimeSignal(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      trigger,
      triggerPayload: event.eventValue,
      ownerUserId: input.ownerUserId,
    })
    results.push(result)
  }
  return results
}

export async function ingestGeV15AutomationRuntimeLeadEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    eventSource: string
    payload?: Record<string, unknown>
    ownerUserId?: string | null
  },
): Promise<GeV15SignalProcessResult | null> {
  const { GE_V1_5_LEAD_EVENT_SOURCE_TO_TRIGGER } = await import(
    "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-triggers"
  )
  const trigger = GE_V1_5_LEAD_EVENT_SOURCE_TO_TRIGGER[input.eventSource]
  if (!trigger) return null
  return processGeV15AutomationRuntimeSignal(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    trigger,
    triggerPayload: input.payload,
    ownerUserId: input.ownerUserId,
  })
}
