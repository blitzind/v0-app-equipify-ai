/** Workflow Automations Phase 2 — shared client types. */

import type { WorkflowTriggerType } from "@/lib/workflows/types"

export type AutomationRow = {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger_type: WorkflowTriggerType
  trigger_config: Record<string, unknown>
  condition_config: Record<string, unknown>
  action_config: Record<string, unknown>
  created_at: string
  updated_at: string
  last_run?: {
    status: string
    started_at: string
    completed_at: string | null
    error_message?: string | null
  } | null
  recent_runs_count?: number
  recent_failure_count?: number
  recent_window_days?: number
}

export type AutomationsResponse = {
  automations: AutomationRow[]
  automationAllowed?: boolean
  planId?: string
}

export type RunHistoryEntry = {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  source_type: string
  source_id: string | null
  error_message: string | null
  logs: Array<{
    id: string
    step: string
    message: string
    metadata: Record<string, unknown>
    created_at: string
  }>
}
