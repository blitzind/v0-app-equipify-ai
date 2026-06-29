/**
 * GE-AIOS-SAFETY-1 — Deterministic autonomous execution guardrail engine (client-safe).
 * Safety decision layer only — no sends, enrollments, or execution mutations.
 */

import {
  AUTONOMOUS_EXECUTION_CONFIDENCE_THRESHOLDS,
  GROWTH_AUTONOMOUS_EXECUTION_GUARDRAIL_QA_MARKER,
  type AutonomousExecutionGuardrailDecision,
  type AutonomousExecutionGuardrailInput,
  type AutonomousExecutionRiskLevel,
} from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-types"

function capExceeded(used: number | undefined, cap: number | undefined, label: string): string | null {
  if (cap == null || used == null) return null
  if (used >= cap) return `${label} cap reached (${used}/${cap})`
  return null
}

function resolveConfidence(input: AutonomousExecutionGuardrailInput): number {
  return (
    input.confidence ??
    input.workQueueItem?.confidence ??
    input.communicationStrategy?.confidence ??
    input.nextBestAction?.confidence ??
    input.revenueExecutionPlan?.confidence ??
    input.qualification?.confidence ??
    0
  )
}

function resolveRiskLevel(input: {
  blocked: boolean
  requiresApproval: boolean
  blockers: string[]
}): AutonomousExecutionRiskLevel {
  if (input.blockers.some((blocker) => blocker.includes("kill switch"))) return "critical"
  if (input.blocked) {
    if (
      input.blockers.some((blocker) =>
        ["suppressed", "unsubscribed", "bounce", "customer", "competitor"].some((token) =>
          blocker.toLowerCase().includes(token),
        ),
      )
    ) {
      return "critical"
    }
    return "high"
  }
  if (input.requiresApproval) return "medium"
  return "low"
}

function evaluateContactSafety(input: AutonomousExecutionGuardrailInput): {
  blockers: string[]
  approvalReasons: string[]
} {
  const blockers: string[] = []
  const approvalReasons: string[] = []

  if (input.suppressed) blockers.push("Lead is suppressed")
  if (input.unsubscribed) blockers.push("Lead unsubscribed from outreach")
  if (input.hardBounced) blockers.push("Hard bounce recorded for contact email")
  if (input.isCustomer || input.leadStatus === "converted") blockers.push("Existing customer — SDR outreach blocked")
  if (input.isCompetitor) blockers.push("Competitor account — outreach blocked")
  if (input.leadStatus === "disqualified" || input.leadStatus === "archived") {
    blockers.push(`Lead status ${input.leadStatus} blocks autonomous execution`)
  }
  if (input.qualification?.qualification === "disqualified") {
    blockers.push("Prospect disqualified")
  }

  const verifiedEmail = input.acquisitionCandidate?.verification.emailVerified === true
  const deliverability = input.acquisitionCandidate?.verification.deliverability
  const hasEmail = Boolean(input.contactEmail?.trim() || input.acquisitionCandidate?.primaryContact.email?.trim())

  if (
    (input.action === "send_email" || input.channel === "email") &&
    !hasEmail
  ) {
    blockers.push("Missing verified contact email")
  }

  if (
    (input.action === "send_email" || input.channel === "email") &&
    hasEmail &&
    !verifiedEmail
  ) {
    approvalReasons.push("Email not verified — human approval required")
  }

  if (deliverability === "risky") {
    approvalReasons.push("Risky deliverability — human approval required")
  }

  if (input.consentFlagPresent === false) {
    approvalReasons.push("Consent flag missing — human approval required")
  }

  if (input.legalBasisPresent === false) {
    approvalReasons.push("Legal basis not recorded — human approval required")
  }

  return { blockers, approvalReasons }
}

function evaluateMailboxSafety(input: AutonomousExecutionGuardrailInput): {
  blockers: string[]
  approvalReasons: string[]
  limitsApplied: string[]
} {
  const blockers: string[] = []
  const approvalReasons: string[] = []
  const limitsApplied: string[] = []
  const mailbox = input.mailbox
  if (!mailbox) return { blockers, approvalReasons, limitsApplied }

  if (mailbox.warmed === false) {
    approvalReasons.push("Mailbox not fully warmed — human approval required")
  }

  const mailboxCap = capExceeded(mailbox.dailyUsed, mailbox.dailyCap, "Mailbox daily")
  if (mailboxCap) blockers.push(mailboxCap)

  const warmupCap = capExceeded(mailbox.warmupUsed, mailbox.warmupCap, "Warmup")
  if (warmupCap) blockers.push(warmupCap)

  const domainCap = capExceeded(mailbox.domainUsed, mailbox.domainCap, "Sender domain")
  if (domainCap) blockers.push(domainCap)

  if (
    mailbox.bounceRatePercent != null &&
    mailbox.bounceRateThreshold != null &&
    mailbox.bounceRatePercent >= mailbox.bounceRateThreshold
  ) {
    blockers.push(
      `Mailbox bounce rate ${mailbox.bounceRatePercent}% exceeds ${mailbox.bounceRateThreshold}% threshold`,
    )
  }

  if (mailbox.spamComplaintDetected) {
    blockers.push("Spam complaint detected on mailbox")
  }

  if (
    mailbox.healthScore != null &&
    mailbox.healthThreshold != null &&
    mailbox.healthScore < mailbox.healthThreshold
  ) {
    approvalReasons.push("Mailbox health below threshold — human approval required")
  }

  if (mailbox.dailyCap != null) limitsApplied.push(`mailbox_daily:${mailbox.dailyUsed ?? 0}/${mailbox.dailyCap}`)
  if (mailbox.warmupCap != null) limitsApplied.push(`warmup:${mailbox.warmupUsed ?? 0}/${mailbox.warmupCap}`)

  return { blockers, approvalReasons, limitsApplied }
}

function evaluateCampaignSafety(input: AutonomousExecutionGuardrailInput): {
  blockers: string[]
  approvalReasons: string[]
  limitsApplied: string[]
} {
  const blockers: string[] = []
  const approvalReasons: string[] = []
  const limitsApplied: string[] = []
  const campaign = input.campaign
  if (!campaign) return { blockers, approvalReasons, limitsApplied }

  if (campaign.active === false) blockers.push("Campaign inactive")
  if (campaign.enrollmentBlocked) blockers.push("Campaign enrollment blocked")
  if (campaign.sequenceDisabled) blockers.push("Sequence disabled")
  if (campaign.alreadyEnrolled) blockers.push("Contact already enrolled in active sequence")
  if (campaign.duplicateTouchScheduled) blockers.push("Duplicate touch already scheduled")
  if (campaign.missingTemplate) blockers.push("Sequence missing required template")
  if (campaign.humanApprovedSequence === false) {
    approvalReasons.push("Sequence requires human approval before enrollment")
  }

  const campaignCap = capExceeded(campaign.dailyUsed, campaign.dailyCap, "Campaign daily")
  if (campaignCap) blockers.push(campaignCap)
  if (campaign.dailyCap != null) {
    limitsApplied.push(`campaign_daily:${campaign.dailyUsed ?? 0}/${campaign.dailyCap}`)
  }

  return { blockers, approvalReasons, limitsApplied }
}

function evaluateChannelSafety(input: AutonomousExecutionGuardrailInput): {
  blockers: string[]
  approvalReasons: string[]
} {
  const blockers: string[] = []
  const approvalReasons: string[] = []
  const provider = input.providerReadiness ?? {}
  const phone = Boolean(input.contactPhone?.trim())
  const action = input.action
  const channel = input.channel

  if (action === "send_email" || channel === "email") {
    if (provider.emailReady === false) blockers.push("Email provider not ready")
    if (provider.templatePresent === false) blockers.push("Email template missing")
    if (provider.unsubscribeFooterAvailable === false) {
      approvalReasons.push("Unsubscribe footer unavailable — human approval required")
    }
  }

  if (action === "send_sms" || channel === "sms") {
    if (!phone) blockers.push("Phone number required for SMS")
    if (provider.smsEnabled === false) blockers.push("SMS sending disabled")
    if (input.consentFlagPresent === false) {
      approvalReasons.push("SMS opt-in/consent not confirmed — human approval required")
    }
  }

  if (action === "launch_voice_drop" || channel === "voice_drop") {
    if (!phone) blockers.push("Phone number required for voice drop")
    if (provider.voiceDropEnabled === false) blockers.push("Voice drop disabled")
    if (provider.voiceDropRecordingApproved === false) {
      blockers.push("Voice drop recording not approved")
    }
  }

  if (action === "place_call" || channel === "phone") {
    if (!phone) blockers.push("Phone number required for call task")
    approvalReasons.push("Call tasks queue only — no autonomous dial")
  }

  if (action === "create_linkedin_task" || channel === "linkedin") {
    approvalReasons.push("LinkedIn remains manual task only — no automated send")
  }

  if (action === "send_video" || channel === "video") {
    if (provider.videoAssetApproved === false) {
      approvalReasons.push("Video asset requires human approval")
    }
    if (provider.videoAutonomousSendEnabled !== true) {
      approvalReasons.push("Automatic video send not enabled — human approval required")
    }
  }

  if (action === "schedule_meeting") {
    approvalReasons.push("Meeting requests require operator scheduling confirmation")
  }

  if (action === "stop" || action === "wait" || action === "request_human_review") {
    approvalReasons.push("Non-execution action — operator review required")
  }

  return { blockers, approvalReasons }
}

function evaluateConfidenceSafety(input: AutonomousExecutionGuardrailInput): {
  approvalReasons: string[]
} {
  const approvalReasons: string[] = []
  const confidence = resolveConfidence(input)
  const threshold = AUTONOMOUS_EXECUTION_CONFIDENCE_THRESHOLDS[input.action] ?? 70
  if (threshold > 0 && confidence < threshold) {
    approvalReasons.push(
      `Confidence ${confidence} below ${threshold} threshold for ${input.action}`,
    )
  }
  return { approvalReasons }
}

function evaluateVolumeSafety(input: AutonomousExecutionGuardrailInput): {
  blockers: string[]
  limitsApplied: string[]
} {
  const blockers: string[] = []
  const limitsApplied: string[] = []
  const volume = input.volume ?? {}
  const channelCaps = input.channelCaps ?? {}

  const orgCap = capExceeded(volume.orgDailyUsed, volume.orgDailyCap, "Organization daily")
  if (orgCap) blockers.push(orgCap)

  const leadCap = capExceeded(volume.perLeadTouchUsed, volume.perLeadTouchCap, "Per-lead touch")
  if (leadCap) blockers.push(leadCap)

  const companyCap = capExceeded(
    volume.perCompanyTouchUsed,
    volume.perCompanyTouchCap,
    "Per-company touch",
  )
  if (companyCap) blockers.push(companyCap)

  const sequenceCap = capExceeded(
    volume.perSequenceUsed,
    volume.perSequenceCap,
    "Per-sequence touch",
  )
  if (sequenceCap) blockers.push(sequenceCap)

  const channelKey = input.channel === "phone" ? "phone" : input.channel
  if (channelKey in (channelCaps.limits ?? {})) {
    const cap = channelCaps.limits?.[channelKey as keyof typeof channelCaps.limits]
    const used = channelCaps.used?.[channelKey as keyof typeof channelCaps.used]
    const channelBlock = capExceeded(used, cap, `${channelKey} channel`)
    if (channelBlock) blockers.push(channelBlock)
    if (cap != null) limitsApplied.push(`${channelKey}:${used ?? 0}/${cap}`)
  }

  if (volume.orgDailyCap != null) {
    limitsApplied.push(`org_daily:${volume.orgDailyUsed ?? 0}/${volume.orgDailyCap}`)
  }

  const pendingTask = input.existingTasks?.find((task) => task.status === "pending")
  if (pendingTask) {
    blockers.push(`Duplicate work already pending (${pendingTask.taskKey})`)
  }

  return { blockers, limitsApplied }
}

function evaluateApprovalSafety(input: AutonomousExecutionGuardrailInput): {
  approvalReasons: string[]
} {
  const approvalReasons: string[] = []

  if (input.approvalState?.humanApprovalPending) {
    approvalReasons.push("Human approval pending")
  }

  if (input.communicationStrategy?.requiresHumanApproval) {
    approvalReasons.push("Communication strategy requires human approval")
  }

  if ((input.revenueExecutionPlan?.approvalsRequired?.length ?? 0) > 0) {
    approvalReasons.push("Revenue execution plan requires human approval")
  }

  if (input.workQueueItem?.requiresHumanApproval) {
    approvalReasons.push("Daily work queue item requires human approval")
  }

  if (input.nextBestAction?.executionReadiness === "blocked") {
    approvalReasons.push("Next best action not execution-ready")
  }

  if ((input.revenueExecutionPlan?.blockers?.length ?? 0) > 0) {
    approvalReasons.push("Revenue execution plan has open blockers")
  }

  if ((input.sequenceRecommendation?.blockers?.length ?? 0) > 0) {
    approvalReasons.push("Sequence recommendation has open blockers")
  }

  return { approvalReasons }
}

export function evaluateAutonomousExecutionGuardrails(
  input: AutonomousExecutionGuardrailInput,
): AutonomousExecutionGuardrailDecision {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString()
  const baseAudit = {
    lead_id: input.leadId,
    company_id: input.companyId ?? null,
    action: input.action,
    channel: input.channel,
    correlation_id: input.correlationId ?? input.workQueueItem?.taskKey ?? input.leadId,
    evaluated_at: evaluatedAt,
    confidence: resolveConfidence(input),
  }

  if (input.guardrailsEnabled === false) {
    return {
      qa_marker: GROWTH_AUTONOMOUS_EXECUTION_GUARDRAIL_QA_MARKER,
      enabled: false,
      allowed: false,
      requiresApproval: true,
      blocked: false,
      riskLevel: "low",
      reasons: ["Autonomous execution guardrails evaluation disabled"],
      blockers: [],
      limitsApplied: [],
      auditMetadata: { ...baseAudit, guardrails_enabled: false },
    }
  }

  if (input.killSwitchActive) {
    return {
      qa_marker: GROWTH_AUTONOMOUS_EXECUTION_GUARDRAIL_QA_MARKER,
      enabled: true,
      allowed: false,
      requiresApproval: true,
      blocked: true,
      riskLevel: "critical",
      reasons: ["Global autonomous execution kill switch active"],
      blockers: ["Global autonomous execution kill switch active"],
      limitsApplied: [],
      auditMetadata: { ...baseAudit, kill_switch: true },
    }
  }

  const blockers: string[] = []
  const approvalReasons: string[] = []
  const limitsApplied: string[] = []
  const reasons: string[] = []

  for (const result of [
    evaluateContactSafety(input),
    evaluateMailboxSafety(input),
    evaluateCampaignSafety(input),
    evaluateChannelSafety(input),
    evaluateVolumeSafety(input),
  ]) {
    blockers.push(...result.blockers)
    if ("approvalReasons" in result) approvalReasons.push(...result.approvalReasons)
    if ("limitsApplied" in result) limitsApplied.push(...result.limitsApplied)
  }

  approvalReasons.push(...evaluateConfidenceSafety(input).approvalReasons)
  approvalReasons.push(...evaluateApprovalSafety(input).approvalReasons)

  const uniqueBlockers = [...new Set(blockers)]
  const uniqueApprovals = [...new Set(approvalReasons)]
  const uniqueLimits = [...new Set(limitsApplied)]

  const blocked = uniqueBlockers.length > 0
  const requiresApproval = !blocked && uniqueApprovals.length > 0
  const allowed = !blocked && !requiresApproval

  if (allowed) reasons.push("Passes autonomous execution guardrails (preview only — execution still requires operator approval)")
  if (requiresApproval) reasons.push(...uniqueApprovals)
  if (blocked) reasons.push(...uniqueBlockers)

  const riskLevel = resolveRiskLevel({ blocked, requiresApproval, blockers: uniqueBlockers })

  return {
    qa_marker: GROWTH_AUTONOMOUS_EXECUTION_GUARDRAIL_QA_MARKER,
    enabled: true,
    allowed,
    requiresApproval,
    blocked,
    riskLevel,
    reasons,
    blockers: uniqueBlockers,
    limitsApplied: uniqueLimits,
    auditMetadata: {
      ...baseAudit,
      decision: blocked ? "blocked" : requiresApproval ? "requires_approval" : "allowed",
      risk_level: riskLevel,
      blockers: uniqueBlockers,
      approval_reasons: uniqueApprovals,
      limits_applied: uniqueLimits,
    },
  }
}

export function summarizeAutonomousExecutionGuardrailDecision(
  decision: AutonomousExecutionGuardrailDecision,
): string {
  if (decision.blocked) return `Blocked (${decision.riskLevel})`
  if (decision.requiresApproval) return `Requires approval (${decision.riskLevel})`
  if (!decision.enabled) return "Guardrails off"
  return `Allowed preview (${decision.riskLevel})`
}
