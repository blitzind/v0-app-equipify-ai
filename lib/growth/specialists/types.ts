/** GE-AIOS-14A — Ava Specialist Orchestration types (client-safe). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export const GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER = "ge-aios-14a-specialist-orchestrator-v1" as const

export type AvaSpecialistId =
  | "sales"
  | "marketing"
  | "customer_success"
  | "service"
  | "finance"

export type AvaSpecialistDefinition = {
  id: AvaSpecialistId
  name: string
  domain: string
  capabilities: string[]
  stub: boolean
}

export type AvaSpecialistRouteResult = {
  specialist_id: AvaSpecialistId
  confidence: number
  reason: string
}

export type AvaSpecialistContribution = {
  specialist_id: AvaSpecialistId
  specialist_name: string
  work_item_id: string
  confidence: number
  routing_reason: string
  summary: string
  stub: boolean
}

export type AvaSpecialistTeamStatus = {
  specialist_id: AvaSpecialistId
  specialist_name: string
  status_label: string
  active_count: number
  is_stub: boolean
}

export type AvaSpecialistOrchestratorResult = {
  qaMarker: typeof GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER
  assignments: AvaSpecialistContribution[]
  team_status: AvaSpecialistTeamStatus[]
  routed_work_items: AvaWorkItemWithSpecialist[]
}

export type AvaWorkItemWithSpecialist = AvaWorkItem & {
  assigned_specialist: AvaSpecialistId
  specialist_confidence: number
  routing_reason: string
}

export const AVA_SPECIALIST_MY_TEAM_TITLE = "My Team" as const

export const AVA_SPECIALIST_STUB_MESSAGE = "Capability not yet implemented." as const
