/** Client-safe Growth Engine next-best-action types. */

export const GROWTH_NEXT_BEST_ACTIONS = [
  "wait_follow_up",
  "wait_for_email_reply",
  "review_email_reply",
  "call_after_email_reply",
  "call_immediately",
  "call_now",
  "escalate_owner_review",
  "owner_follow_up",
  "immediate_owner_attention",
  "rebuild_relationship",
  "immediate_sales_action",
  "owner_close_motion",
  "executive_close_motion",
  "executive_takeover",
  "executive_intervention",
  "secure_decision_maker",
  "unblock_progress",
  "reduce_new_outreach",
  "redistribute_attention",
  "protect_close_motion",
  "reengage",
  "run_research",
  "refresh_research",
  "fix_website_research",
  "find_decision_maker",
  "call_primary_contact",
  "call_decision_maker",
  "retry_call",
  "review_disqualified",
  "manual_review",
  "accelerate_close_motion",
  "relationship_recovery",
  "competitive_response_motion",
  "immediate_follow_up",
  "conversation_recovery_motion",
  "start_recommended_sequence",
  "switch_sequence_pattern",
  "use_executive_sequence",
] as const

export type GrowthNextBestAction = (typeof GROWTH_NEXT_BEST_ACTIONS)[number]

export const GROWTH_NEXT_BEST_ACTION_LABELS: Record<GrowthNextBestAction, string> = {
  wait_follow_up: "Wait for follow-up",
  wait_for_email_reply: "Wait for email reply",
  review_email_reply: "Review email reply",
  call_after_email_reply: "Call after email reply",
  call_immediately: "Call immediately",
  call_now: "Call now",
  escalate_owner_review: "Escalate for owner review",
  owner_follow_up: "Owner follow-up",
  immediate_owner_attention: "Immediate owner attention",
  rebuild_relationship: "Rebuild relationship",
  immediate_sales_action: "Immediate sales action",
  owner_close_motion: "Owner close motion",
  executive_close_motion: "Executive close motion",
  executive_takeover: "Executive takeover",
  executive_intervention: "Executive intervention",
  secure_decision_maker: "Secure decision maker",
  unblock_progress: "Unblock progress",
  reduce_new_outreach: "Reduce new outreach",
  redistribute_attention: "Redistribute attention",
  protect_close_motion: "Protect close motion",
  reengage: "Re-engage lead",
  run_research: "Run research",
  refresh_research: "Refresh research",
  fix_website_research: "Fix website research",
  find_decision_maker: "Find decision maker",
  call_primary_contact: "Call primary contact",
  call_decision_maker: "Call decision maker",
  retry_call: "Retry call",
  review_disqualified: "Review disqualified",
  manual_review: "Manual review",
  accelerate_close_motion: "Accelerate close motion",
  relationship_recovery: "Relationship recovery",
  competitive_response_motion: "Competitive response motion",
  immediate_follow_up: "Immediate follow-up",
  conversation_recovery_motion: "Conversation recovery motion",
  start_recommended_sequence: "Start recommended sequence",
  switch_sequence_pattern: "Switch sequence pattern",
  use_executive_sequence: "Use executive sequence",
}

export type GrowthNextBestActionResult = {
  action: GrowthNextBestAction
  label: string
  reason: string
  blockers: string[]
  confidence: "high" | "medium" | "low"
  actionVersion: "v1" | "v2"
}
