import type { GrowthCommandActionKind, GrowthCommandBossBattleKind, GrowthCommandOperatorRank } from "@/lib/growth/command/command-action-types"

export const COMMAND_ACTION_BASE_IMPACT: Record<GrowthCommandActionKind, number> = {
  executive_intervention: 100,
  revenue_rescue: 92,
  confirm_sequence: 88,
  queue_sequence_step: 86,
  approve_outreach: 85,
  review_draft: 82,
  start_call_copilot: 80,
  follow_up_now: 78,
  conversation_recovery: 76,
  relationship_recovery: 72,
  add_decision_maker: 68,
  run_research: 60,
  capacity_action: 55,
}

export const COMMAND_ACTION_EFFORT_MINUTES: Record<GrowthCommandActionKind, number> = {
  executive_intervention: 15,
  revenue_rescue: 15,
  confirm_sequence: 5,
  queue_sequence_step: 5,
  approve_outreach: 5,
  review_draft: 10,
  start_call_copilot: 15,
  follow_up_now: 10,
  conversation_recovery: 10,
  relationship_recovery: 10,
  add_decision_maker: 8,
  run_research: 12,
  capacity_action: 10,
}

export const COMMAND_ACTION_LABELS: Record<GrowthCommandActionKind, string> = {
  executive_intervention: "Executive Intervention",
  revenue_rescue: "Revenue Rescue",
  confirm_sequence: "Confirm Sequence",
  queue_sequence_step: "Queue Sequence Step",
  approve_outreach: "Approve Outreach",
  review_draft: "Review Draft",
  start_call_copilot: "Start Call Copilot",
  follow_up_now: "Follow Up Now",
  conversation_recovery: "Conversation Recovery",
  relationship_recovery: "Relationship Recovery",
  add_decision_maker: "Add Decision Maker",
  run_research: "Run Research",
  capacity_action: "Capacity Action",
}

export const COMMAND_CTA_LABELS: Record<GrowthCommandActionKind, string> = {
  executive_intervention: "Open Executive View",
  revenue_rescue: "Rescue Revenue",
  confirm_sequence: "Confirm Sequence",
  queue_sequence_step: "Queue Step",
  approve_outreach: "Approve Outreach",
  review_draft: "Review Draft",
  start_call_copilot: "Start Call Copilot",
  follow_up_now: "Follow Up Now",
  conversation_recovery: "Recover Conversation",
  relationship_recovery: "Recover Relationship",
  add_decision_maker: "Add Decision Maker",
  run_research: "Run Research",
  capacity_action: "Review Capacity",
}

export const COMMAND_BOSS_BATTLE_FOR_KIND: Partial<Record<GrowthCommandActionKind, GrowthCommandBossBattleKind>> = {
  executive_intervention: "executive_attention",
  revenue_rescue: "revenue_rescue",
  confirm_sequence: "sequence_cleanup",
  queue_sequence_step: "sequence_cleanup",
  approve_outreach: "sequence_cleanup",
  review_draft: "sequence_cleanup",
  follow_up_now: "follow_up_sprint",
  start_call_copilot: "follow_up_sprint",
  conversation_recovery: "follow_up_sprint",
  relationship_recovery: "revenue_rescue",
  capacity_action: "executive_attention",
}

export const COMMAND_AUTONOMOUS_KINDS: GrowthCommandActionKind[] = []

export const OPERATOR_RANK_THRESHOLDS: Array<{ min: number; rank: GrowthCommandOperatorRank; label: string }> = [
  { min: 1200, rank: "execution_master", label: "Execution Master" },
  { min: 800, rank: "pipeline_commander", label: "Pipeline Commander" },
  { min: 500, rank: "revenue_operator", label: "Revenue Operator" },
  { min: 250, rank: "growth_builder", label: "Growth Builder" },
  { min: 100, rank: "coordinator", label: "Coordinator" },
  { min: 0, rank: "new_operator", label: "New Operator" },
]

export function commandLeadFocusHref(leadId: string, focus: string, referenceId?: string | null): string {
  const params = new URLSearchParams({ open: leadId, focus })
  if (referenceId) params.set("highlight", referenceId)
  return `/admin/growth/leads?${params.toString()}`
}

export function commandOutreachHref(queueId: string): string {
  return `/admin/growth/sequences/execution?highlight=${encodeURIComponent(queueId)}`
}

export function commandSequenceExecutionHref(enrollmentId: string): string {
  return `/admin/growth/sequences/execution?highlight=${encodeURIComponent(enrollmentId)}`
}
