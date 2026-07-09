/** GE-AIOS-17A — Canonical Sales Specialist outcome model (client-safe). */

import type { AvaMemoryEvent } from "@/lib/growth/memory/types"

export const GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER =
  "ge-aios-17a-specialist-execution-bridge-v1" as const

export type SalesWorkflowAgentKind =
  | "research_agent"
  | "qualification_agent"
  | "outreach_agent"
  | "meeting_agent"

export type SalesOutcomeType =
  | "research_completed"
  | "qualification_completed"
  | "outreach_prepared"
  | "meeting_prepared"
  | "approval_pending"

export type SalesOutcome = {
  work_item_id: string | null
  company_id: string | null
  person_id: string | null
  relationship_stage: string | null
  outcome_type: SalesOutcomeType
  confidence: number
  completed_by: SalesWorkflowAgentKind
  validated_by: "sales_specialist"
  completed_at: string
  summary: string
  generated_artifacts: string[]
  approval_required: boolean
  recommended_next_action: string | null
  memory_events: AvaMemoryEvent[]
}

export type SalesOutcomeDailySummary = {
  qaMarker: typeof GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER
  generatedAt: string
  researched: number
  qualified: number
  strong_opportunities: number
  outreach_prepared: number
  meetings_prepared: number
  approvals_pending: number
}

export type SalesSpecialistDelegationResult =
  | {
      delegated: true
      specialist_id: "sales"
      workflow_agent: SalesWorkflowAgentKind
      routing_reason: string
      work_item_id: string
    }
  | {
      delegated: false
      reason: "non_sales_work" | "stub_specialist" | "unsupported_work_type"
      work_item_id?: string
    }

export type SalesSpecialistCompletionResult =
  | { completed: true; outcome: SalesOutcome }
  | { completed: false; reason: "invalid_outcome" | "validation_failed"; detail?: string }

export type GrowthHomeSalesOutcomesPayload = {
  qaMarker: typeof GROWTH_SALES_SPECIALIST_EXECUTION_BRIDGE_QA_MARKER
  outcomes: SalesOutcome[]
  dailySummary: SalesOutcomeDailySummary
}
