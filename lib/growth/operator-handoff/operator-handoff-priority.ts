import type { GrowthOperatorHandoffInput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import type {
  GrowthOperatorHandoffChannel,
  GrowthOperatorHandoffLeadPriority,
  GrowthOperatorHandoffMotion,
  GrowthOperatorHandoffOwner,
  GrowthOperatorHandoffUrgency,
} from "@/lib/growth/operator-handoff/operator-handoff-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineHumanApprovalOutput } from "@/lib/growth/lead-engine/human-approval-types"
import type { GrowthLeadEngineRevenueExecutionOutput } from "@/lib/growth/lead-engine/revenue-execution-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"

export type GrowthOperatorHandoffPriorityHints = {
  lead_priority: GrowthOperatorHandoffLeadPriority
  recommended_motion: GrowthOperatorHandoffMotion
  recommended_owner: GrowthOperatorHandoffOwner
  recommended_channel: GrowthOperatorHandoffChannel
  recommended_urgency: GrowthOperatorHandoffUrgency
  recommended_next_action: string
  recommended_followup_window: string
}

function asObject<T>(value: T | string | undefined): T | null {
  return value && typeof value === "object" ? value : null
}

export function mapLeadScorePriority(
  priority: string | undefined,
): GrowthOperatorHandoffLeadPriority {
  const raw = (priority ?? "").toLowerCase()
  if (raw === "high") return "high"
  if (raw === "medium") return "medium"
  if (raw === "disqualified") return "monitor"
  return "low"
}

export function computeOperatorHandoffPriorityHints(
  input: GrowthOperatorHandoffInput,
): GrowthOperatorHandoffPriorityHints {
  const leadScore = asObject<GrowthLeadEngineLeadScoreOutput>(input.leadScore)
  const approval = asObject<GrowthLeadEngineHumanApprovalOutput>(input.humanApproval)
  const verification = asObject<GrowthLeadEngineVerificationTriageOutput>(input.verificationTriage)
  const revenue = asObject<GrowthLeadEngineRevenueExecutionOutput>(input.revenueExecution)
  const inbox = input.leadInbox

  const disposition = verification?.disposition ?? ""
  const approvalStatus = approval?.approval_status ?? ""
  const leadScoreValue = leadScore?.lead_score ?? inbox?.intent_score ?? 0
  const nextAction = leadScore?.recommended_next_action ?? "approve_for_human_review"

  let lead_priority = mapLeadScorePriority(leadScore?.priority_level)
  if (inbox?.candidate_priority === "urgent") lead_priority = "high"
  if (approvalStatus === "blocked" || disposition === "reject") lead_priority = "monitor"

  let recommended_motion: GrowthOperatorHandoffMotion = "review"
  if (disposition === "reject" || nextAction === "disqualify" || approvalStatus === "blocked") {
    recommended_motion = "disqualify"
  } else if (nextAction === "enrich_more") {
    recommended_motion = "enrich"
  } else if (nextAction === "verify_contact" || disposition === "risky") {
    recommended_motion = "verify_contact"
  } else if (leadScoreValue >= 75 && disposition === "validated") {
    recommended_motion = revenue?.recommended_channels?.[0] === "PHONE" ? "call_first" : "email_first"
  } else if (leadScoreValue < 50) {
    recommended_motion = "research_more"
  } else if (approvalStatus === "approved") {
    recommended_motion = "call_first"
  }

  let recommended_owner: GrowthOperatorHandoffOwner = "sales"
  const ownerType = revenue?.recommended_owner_type
  if (ownerType === "founder") recommended_owner = "founder"
  else if (ownerType === "sdr") recommended_owner = "sdr"
  else if (ownerType === "account_executive") recommended_owner = "account_executive"
  else if (ownerType === "marketing") recommended_owner = "marketing"
  else if (ownerType === "partner") recommended_owner = "partner"
  else if (leadScoreValue >= 80) recommended_owner = "account_executive"
  else if (leadScoreValue < 55) recommended_owner = "sdr"

  let recommended_channel: GrowthOperatorHandoffChannel = "NONE"
  const channel = revenue?.recommended_channels?.[0]
  if (channel === "PHONE") recommended_channel = "PHONE"
  else if (channel === "EMAIL") recommended_channel = "EMAIL"
  else if (channel === "LINKEDIN") recommended_channel = "LINKEDIN"
  else if (recommended_motion === "call_first") recommended_channel = "PHONE"
  else if (recommended_motion === "email_first") recommended_channel = "EMAIL"
  else if (recommended_motion === "linkedin_first") recommended_channel = "LINKEDIN"

  let recommended_urgency: GrowthOperatorHandoffUrgency = "this_week"
  if (inbox?.candidate_priority === "urgent" || approval?.approval_priority === "urgent") {
    recommended_urgency = "immediate"
  } else if (lead_priority === "high" && disposition === "validated") {
    recommended_urgency = "today"
  } else if (lead_priority === "monitor" || disposition === "reject") {
    recommended_urgency = "monitor"
  }

  let recommended_next_action = "Review handoff package and confirm motion before any outreach."
  if (recommended_motion === "disqualify") {
    recommended_next_action = "Disqualify or archive — do not initiate outbound."
  } else if (recommended_motion === "verify_contact") {
    recommended_next_action = "Verify contact channels before first touch."
  } else if (recommended_motion === "enrich") {
    recommended_next_action = "Enrich account and contacts before outreach planning."
  } else if (recommended_motion === "call_first") {
    recommended_next_action = "Prepare for call — use talking points only, no drafted email."
  } else if (recommended_motion === "research_more") {
    recommended_next_action = "Gather additional evidence before assigning owner."
  }

  let recommended_followup_window = "Within 5 business days"
  if (recommended_urgency === "immediate") recommended_followup_window = "Within 4 hours"
  else if (recommended_urgency === "today") recommended_followup_window = "Within 1 business day"
  else if (recommended_urgency === "monitor") recommended_followup_window = "Re-evaluate in 2-4 weeks"

  return {
    lead_priority,
    recommended_motion,
    recommended_owner,
    recommended_channel,
    recommended_urgency,
    recommended_next_action,
    recommended_followup_window,
  }
}

export function compareOperatorHandoffPriority(
  a: GrowthOperatorHandoffLeadPriority,
  b: GrowthOperatorHandoffLeadPriority,
): number {
  const rank: Record<GrowthOperatorHandoffLeadPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
    monitor: 3,
  }
  return rank[a] - rank[b]
}
