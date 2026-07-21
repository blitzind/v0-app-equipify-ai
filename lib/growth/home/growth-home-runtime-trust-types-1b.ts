/** GE-AIOS-LAUNCH-1B — Runtime trust payload types (client-safe). */

import type { GrowthAvaActivationState, GrowthAvaEmploymentStats } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import type { GrowthRuntimeKillSwitchKey } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export const GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER = "ge-aios-launch-1b-runtime-trust-v1" as const

export type GrowthHomeRuntimeTrustOperatorState =
  | "working"
  | "waiting"
  | "scheduled"
  | "idle"
  | "blocked"

export type GrowthHomeRuntimeTrustServerPayload = {
  qaMarker: typeof GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER
  generatedAt: string
  killSwitches: Partial<Record<GrowthRuntimeKillSwitchKey, boolean>>
  autonomyTickHealth: GrowthAiosAutonomyTickHealthSnapshot | null
  lastSchedulerRunAt: string | null
  lastSchedulerOk: boolean | null
  nextSchedulerEstimateAt: string | null
}

export type GrowthHomeRuntimeTrustHeartbeatLine = {
  id: string
  label: string
  value: string
}

export type GrowthHomeRuntimeTrustActivityEntry = {
  id: string
  timeLabel: string
  summary: string
  occurredAt: string
}

export type GrowthHomeRuntimeTrustPipelineStep = {
  id: string
  label: string
  complete: boolean
  active: boolean
}

export type GrowthHomeRuntimeTrustCurrentActivity = {
  companyName: string | null
  taskLabel: string | null
  currentStepLabel: string | null
  startedAt: string | null
  startedLabel: string | null
  expectedCompletionMinutes: number | null
  expectedCompletionLabel: string | null
  pipelineSteps: GrowthHomeRuntimeTrustPipelineStep[]
}

export type GrowthHomeRuntimeTrustStartStatus = {
  mode:
    | "autonomous_active"
    | "employee_active"
    | "activation_required"
    | "needs_operator_action"
    | "setup_required"
    | "autonomous_paused"
  headline: string
  detail: string | null
  primaryActionLabel: string | null
  primaryActionHref: string | null
  primaryActionKind: "link" | "activate" | null
  lastAutonomousActionAt: string | null
  lastAutonomousActionLabel: string | null
}

export type GrowthHomeRuntimeTrustViewModel = {
  qaMarker: typeof GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER
  operatorState: GrowthHomeRuntimeTrustOperatorState
  operatorStateLabel: string
  statusExplanation: string
  idleReason: string | null
  blockedReason: string | null
  heartbeat: GrowthHomeRuntimeTrustHeartbeatLine[]
  currentActivity: GrowthHomeRuntimeTrustCurrentActivity | null
  activityFeed: GrowthHomeRuntimeTrustActivityEntry[]
  startStatus: GrowthHomeRuntimeTrustStartStatus
  /** GE-AIOS-LAUNCH-1C — employee mode after one-time activation */
  employeeMode: boolean
  showActivationScreen: boolean
  activation: GrowthAvaActivationState | null
  employment: GrowthAvaEmploymentStats | null
  employeePresenceLine: string | null
  nextMilestoneLabel: string | null
}
