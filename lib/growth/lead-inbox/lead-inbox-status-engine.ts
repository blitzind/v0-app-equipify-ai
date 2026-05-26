import type {
  GrowthLeadInboxPipelineStatus,
  GrowthLeadInboxStatus,
} from "@/lib/growth/lead-inbox/lead-inbox-types"

const ALLOWED_TRANSITIONS: Record<GrowthLeadInboxStatus, GrowthLeadInboxStatus[]> = {
  new: ["reviewing", "disqualified", "duplicate", "archived"],
  reviewing: ["approved", "disqualified", "duplicate", "archived", "new"],
  approved: ["enriching", "running_pipeline", "disqualified", "archived"],
  enriching: ["running_pipeline", "disqualified", "archived", "approved"],
  running_pipeline: ["pipeline_complete", "disqualified", "archived"],
  pipeline_complete: ["archived"],
  disqualified: ["archived"],
  duplicate: ["archived"],
  archived: [],
}

export function canTransitionLeadInboxStatus(
  from: GrowthLeadInboxStatus,
  to: GrowthLeadInboxStatus,
): boolean {
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertLeadInboxStatusTransition(
  from: GrowthLeadInboxStatus,
  to: GrowthLeadInboxStatus,
): { ok: true } | { ok: false; message: string } {
  if (canTransitionLeadInboxStatus(from, to)) return { ok: true }
  return {
    ok: false,
    message: `Invalid inbox status transition: ${from} → ${to}.`,
  }
}

export function pipelineStatusForInboxStatus(
  status: GrowthLeadInboxStatus,
  current: GrowthLeadInboxPipelineStatus,
): GrowthLeadInboxPipelineStatus {
  if (status === "approved" || status === "enriching") {
    return current === "not_started" ? "queued" : current
  }
  if (status === "running_pipeline") return "running"
  if (status === "pipeline_complete") return "completed"
  if (status === "disqualified" || status === "duplicate" || status === "archived") {
    return current === "running" ? "failed" : current
  }
  return current
}

export function requiresHumanReview(status: GrowthLeadInboxStatus): boolean {
  return !["pipeline_complete", "disqualified", "duplicate", "archived"].includes(status)
}
