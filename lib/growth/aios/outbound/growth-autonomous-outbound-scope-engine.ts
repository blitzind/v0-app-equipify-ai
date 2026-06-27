/** GE-AI-2I — Bounded Autonomous Outbound gate engine (client-safe, deterministic). */

import {
  buildCommunicationContextFromOutboundScope,
  summarizeGrowthCommunicationPlan,
  synthesizeGrowthCommunicationPlan,
} from "@/lib/growth/aios/communication/growth-communication-engine-engine"
import { VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED } from "@/lib/voice/voice-drops/types"
import type {
  GrowthAutonomousOutboundActionRecord,
  GrowthAutonomousOutboundActionType,
  GrowthAutonomousOutboundChannel,
  GrowthAutonomousOutboundConsumption,
  GrowthAutonomousOutboundGateEvaluation,
  GrowthAutonomousOutboundGateId,
  GrowthAutonomousOutboundGateResult,
  GrowthAutonomousOutboundScope,
  GrowthAutonomousOutboundScopeRow,
  GrowthAutonomousOutboundStopCondition,
  GrowthBoundedAutonomousOutboundReadModel,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  GROWTH_BOUNDED_AUTONOMOUS_OUTBOUND_RULE,
  GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

const BOUNDED_OUTBOUND_HREF = "/growth/os/approvals"

export function mapOutboundChannelToAutonomyCapability(
  channel: GrowthAutonomousOutboundChannel,
): string {
  switch (channel) {
    case "email":
      return "email_execution"
    case "sms":
      return "sms_execution"
    case "voice_drop":
    case "ai_voice":
      return "voice_execution"
    case "video":
      return "video_execution"
    default:
      return "manual_execution"
  }
}

export function mapActionTypeToChannel(
  actionType: GrowthAutonomousOutboundActionType,
): GrowthAutonomousOutboundChannel {
  switch (actionType) {
    case "send_email":
      return "email"
    case "send_sms":
      return "sms"
    case "launch_voice_drop":
      return "voice_drop"
    case "start_ai_voice_session":
      return "ai_voice"
    case "create_linkedin_manual_task":
      return "linkedin_manual"
    case "create_video_sendr_task":
      return "video"
  }
}

export function resolveTransportPath(channel: GrowthAutonomousOutboundChannel): string {
  if (channel === "linkedin_manual") return GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.linkedin_manual
  if (channel === "video") return GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.video
  if (channel === "ai_voice") return GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.ai_voice
  if (channel === "voice_drop") return GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.voice_drop
  if (channel === "sms") return GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.sms
  return GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.email
}

function gate(gateId: GrowthAutonomousOutboundGateId, passed: boolean, reason: string | null): GrowthAutonomousOutboundGateResult {
  return { gateId, passed, reason }
}

export function isLeadInApprovedAudience(
  scope: GrowthAutonomousOutboundScope,
  leadId: string | null,
): boolean {
  if (!leadId) return false
  const { audience } = scope
  if (audience.leadIds && audience.leadIds.length > 0) {
    return audience.leadIds.includes(leadId)
  }
  if (audience.maxAudienceSize !== undefined && audience.leadIds) {
    return audience.leadIds.includes(leadId) && audience.leadIds.length <= audience.maxAudienceSize
  }
  return Boolean(audience.leadIds?.includes(leadId))
}

export function isScopeExpired(scope: GrowthAutonomousOutboundScope, nowIso: string): boolean {
  return Date.parse(scope.expiresAt) <= Date.parse(nowIso)
}

export function isWithinScopeQuietHours(
  scope: GrowthAutonomousOutboundScope,
  now: Date,
): boolean {
  const quiet = scope.limits.quietHours
  if (!quiet) return false

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: quiet.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")
  const currentMinutes = hour * 60 + minute

  const [startHour, startMinute] = quiet.start.split(":").map(Number)
  const [endHour, endMinute] = quiet.end.split(":").map(Number)
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

export function computeOutboundConsumption(input: {
  scopeId: string
  actions: GrowthAutonomousOutboundActionRecord[]
  dayStartIso: string
}): GrowthAutonomousOutboundConsumption {
  const scopeActions = input.actions.filter((row) => row.scopeId === input.scopeId)
  const completed = scopeActions.filter((row) => row.status === "completed" || row.status === "queued")
  const today = completed.filter((row) => Date.parse(row.createdAt) >= Date.parse(input.dayStartIso))

  const actionsByLead: Record<string, number> = {}
  for (const row of completed) {
    if (!row.leadId) continue
    actionsByLead[row.leadId] = (actionsByLead[row.leadId] ?? 0) + 1
  }

  return {
    actionsTotal: completed.length,
    actionsToday: today.length,
    actionsByLead,
    emailsToday: today.filter((row) => row.channel === "email").length,
    smsToday: today.filter((row) => row.channel === "sms").length,
    voiceDropsToday: today.filter((row) => row.channel === "voice_drop").length,
  }
}

export function evaluateBoundedOutboundGateMatrix(input: {
  scope: GrowthAutonomousOutboundScope
  channel: GrowthAutonomousOutboundChannel
  leadId: string | null
  nowIso: string
  consumption: GrowthAutonomousOutboundConsumption
  autonomyAllowed: boolean
  autonomyReason: string | null
  suppressionBlocked: boolean
  optOutBlocked: boolean
  complianceBlocked: boolean
  senderReady: boolean
  activeStopConditions: GrowthAutonomousOutboundStopCondition[]
  voiceDropLiveCertified?: boolean
}): GrowthAutonomousOutboundGateEvaluation {
  const results: GrowthAutonomousOutboundGateResult[] = []
  const now = new Date(input.nowIso)

  results.push(
    gate(
      "scope_status",
      input.scope.status === "active" && !isScopeExpired(input.scope, input.nowIso),
      input.scope.status !== "active"
        ? `Scope status is ${input.scope.status}.`
        : isScopeExpired(input.scope, input.nowIso)
          ? "Scope expired."
          : null,
    ),
  )

  results.push(
    gate(
      "human_approval",
      Boolean(input.scope.approvedByUserId && input.scope.approvedAt),
      input.scope.approvedByUserId ? null : "Human approval missing.",
    ),
  )

  results.push(
    gate("growth_autonomy", input.autonomyAllowed, input.autonomyReason),
  )

  results.push(
    gate(
      "audience",
      input.leadId ? isLeadInApprovedAudience(input.scope, input.leadId) : false,
      input.leadId ? null : "Lead id required.",
    ),
  )

  results.push(
    gate(
      "channel",
      input.scope.allowedChannels.includes(input.channel),
      input.scope.allowedChannels.includes(input.channel)
        ? null
        : `Channel ${input.channel} not in approved scope.`,
    ),
  )

  const withinQuietHours = isWithinScopeQuietHours(input.scope, now)
  results.push(
    gate(
      "quiet_hours",
      !withinQuietHours,
      withinQuietHours ? "Inside quiet hours window." : null,
    ),
  )

  results.push(
    gate(
      "budget",
      input.consumption.actionsTotal < input.scope.limits.maxActionsTotal &&
        input.consumption.actionsToday < input.scope.limits.maxActionsPerDay &&
        (input.leadId
          ? (input.consumption.actionsByLead[input.leadId] ?? 0) < input.scope.limits.maxActionsPerLead
          : true) &&
        (input.channel !== "email" ||
          input.consumption.emailsToday < (input.scope.limits.maxEmailsPerDay ?? input.scope.limits.maxActionsPerDay)) &&
        (input.channel !== "sms" ||
          input.consumption.smsToday < (input.scope.limits.maxSmsPerDay ?? input.scope.limits.maxActionsPerDay)) &&
        (input.channel !== "voice_drop" ||
          input.consumption.voiceDropsToday <
            (input.scope.limits.maxVoiceDropsPerDay ?? input.scope.limits.maxActionsPerDay)),
      "Budget or cap exceeded for scope.",
    ),
  )

  results.push(gate("suppression", !input.suppressionBlocked, input.suppressionBlocked ? "Suppression list match." : null))
  results.push(gate("opt_out", !input.optOutBlocked, input.optOutBlocked ? "Opt-out active." : null))
  results.push(gate("compliance", !input.complianceBlocked, input.complianceBlocked ? "Compliance block." : null))
  results.push(gate("sender_readiness", input.senderReady, input.senderReady ? null : "Sender/channel not ready."))

  results.push(
    gate(
      "stop_condition",
      input.activeStopConditions.length === 0,
      input.activeStopConditions.length > 0 ? `Stop: ${input.activeStopConditions.join(", ")}` : null,
    ),
  )

  if (input.channel === "voice_drop") {
    const voiceAllowed =
      !VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED ||
      Boolean(input.scope.voiceDropCertified && input.voiceDropLiveCertified)
    results.push(
      gate(
        "voice_drop_certified",
        voiceAllowed,
        voiceAllowed ? null : "Voice drop autonomous outbound disabled — certification required.",
      ),
    )
  }

  if (input.channel === "ai_voice") {
    results.push(
      gate(
        "ai_voice_explicit",
        Boolean(input.scope.aiVoiceExplicitlyApproved),
        input.scope.aiVoiceExplicitlyApproved ? null : "AI Voice requires explicit scope approval.",
      ),
    )
  }

  const blockedGates = results.filter((row) => !row.passed)
  const passedGates = results.filter((row) => row.passed)

  return {
    allowed: blockedGates.length === 0,
    blockedGates,
    passedGates,
    summary: blockedGates.length === 0 ? "All gates passed." : blockedGates.map((row) => row.reason).filter(Boolean).join(" "),
  }
}

export function evaluateAutonomousOutboundActivationEligibility(input: {
  scope: GrowthAutonomousOutboundScope
  nowIso: string
  killSwitchStatus: {
    autonomyEnabled: boolean
    autonomyOutboundEnabled: boolean
    emergencyStopActive: boolean
  }
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = []
  const { scope, nowIso, killSwitchStatus } = input

  if (scope.status !== "approved") {
    reasons.push(`Scope status is ${scope.status}.`)
  }
  if (!scope.approvedByUserId || !scope.approvedAt) {
    reasons.push("Human approval metadata missing.")
  }
  if (isScopeExpired(scope, nowIso)) {
    reasons.push("Scope expired.")
  }
  const audience = scope.audience
  const hasAudience =
    (audience.leadIds?.length ?? 0) > 0 ||
    (audience.companyIds?.length ?? 0) > 0 ||
    (audience.personIds?.length ?? 0) > 0 ||
    Boolean(audience.savedSearchId)
  if (!hasAudience) {
    reasons.push("Audience not configured.")
  }
  if (
    scope.limits.maxActionsTotal <= 0 ||
    scope.limits.maxActionsPerDay <= 0 ||
    scope.limits.maxActionsPerLead <= 0
  ) {
    reasons.push("Scope limits invalid.")
  }
  if (scope.allowedChannels.length === 0) {
    reasons.push("No allowed channels.")
  }
  if (!killSwitchStatus.autonomyEnabled || !killSwitchStatus.autonomyOutboundEnabled) {
    reasons.push("Growth Autonomy outbound disabled.")
  }
  if (killSwitchStatus.emergencyStopActive) {
    reasons.push("Emergency stop active.")
  }

  return { eligible: reasons.length === 0, reasons }
}

export function resolveActiveStopConditions(input: {
  scope: GrowthAutonomousOutboundScope
  triggered: GrowthAutonomousOutboundStopCondition[]
}): GrowthAutonomousOutboundStopCondition[] {
  const active = new Set<GrowthAutonomousOutboundStopCondition>()
  for (const condition of input.triggered) {
    if (condition === "on_reply" && input.scope.stopConditions.onReply) active.add(condition)
    if (condition === "on_positive_intent" && input.scope.stopConditions.onPositiveIntent) active.add(condition)
    if (condition === "on_negative_intent" && input.scope.stopConditions.onNegativeIntent) active.add(condition)
    if (condition === "on_bounce" && input.scope.stopConditions.onBounce) active.add(condition)
    if (condition === "on_unsubscribe" && input.scope.stopConditions.onUnsubscribe) active.add(condition)
    if (condition === "on_meeting_booked" && input.scope.stopConditions.onMeetingBooked) active.add(condition)
    if (condition === "on_manual_pause" && input.scope.stopConditions.onManualPause) active.add(condition)
  }
  if (input.scope.status === "paused" && input.scope.stopConditions.onManualPause) {
    active.add("on_manual_pause")
  }
  return [...active]
}

export function buildAutonomousOutboundScopeRow(input: {
  scope: GrowthAutonomousOutboundScope
  actions: GrowthAutonomousOutboundActionRecord[]
  stopConditionTriggers: Array<{ scopeId: string; condition: GrowthAutonomousOutboundStopCondition }>
  dayStartIso: string
  generatedAt: string
}): GrowthAutonomousOutboundScopeRow {
  const consumption = computeOutboundConsumption({
    scopeId: input.scope.id,
    actions: input.actions,
    dayStartIso: input.dayStartIso,
  })
  const triggered = input.stopConditionTriggers
    .filter((row) => row.scopeId === input.scope.id)
    .map((row) => row.condition)
  const activeStopConditions = resolveActiveStopConditions({
    scope: input.scope,
    triggered,
  })
  const nextQueuedAction =
    input.actions.find(
      (row) => row.scopeId === input.scope.id && (row.status === "queued" || row.status === "selected"),
    ) ?? null

  const quietHoursActive = isWithinScopeQuietHours(input.scope, new Date(input.generatedAt))
  const communicationPlan = synthesizeGrowthCommunicationPlan({
    organizationId: input.scope.organizationId,
    subject: {
      type: input.scope.source === "objective" ? "objective" : "campaign",
      id: input.scope.sourceId,
    },
    context: buildCommunicationContextFromOutboundScope({
      scopeAllowedChannels: input.scope.allowedChannels,
      voiceDropCertified: input.scope.voiceDropCertified,
      aiVoiceExplicitlyAllowed: input.scope.aiVoiceExplicitlyApproved,
      quietHoursActive,
    }),
    generatedAt: input.generatedAt,
  })

  return {
    scope: input.scope,
    consumption,
    nextQueuedAction,
    activeStopConditions,
    configureHref: BOUNDED_OUTBOUND_HREF,
    communicationPlanSummary: summarizeGrowthCommunicationPlan(communicationPlan),
  }
}

export function synthesizeBoundedAutonomousOutboundReadModel(input: {
  organizationId: string
  generatedAt: string
  scopes: GrowthAutonomousOutboundScope[]
  actions: GrowthAutonomousOutboundActionRecord[]
  stopConditionTriggers: GrowthBoundedAutonomousOutboundReadModel["stopConditionTriggers"]
  killSwitchStatus: GrowthBoundedAutonomousOutboundReadModel["killSwitchStatus"]
  lastEventAt: string | null
  lastEventType: string | null
}): GrowthBoundedAutonomousOutboundReadModel {
  const dayStart = new Date(input.generatedAt)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayStartIso = dayStart.toISOString()

  const rows = input.scopes.map((scope) =>
    buildAutonomousOutboundScopeRow({
      scope,
      actions: input.actions,
      stopConditionTriggers: input.stopConditionTriggers,
      dayStartIso,
      generatedAt: input.generatedAt,
    }),
  )

  const approvedScopes = rows.filter((row) => row.scope.status === "approved")
  const activeScopes = rows.filter((row) => row.scope.status === "active")
  const blockedScopes = rows.filter((row) => row.scope.status === "blocked")
  const pausedScopes = rows.filter((row) => row.scope.status === "paused")

  const todayActions = input.actions.filter((row) => Date.parse(row.createdAt) >= Date.parse(dayStartIso))
  const channelMixToday: GrowthBoundedAutonomousOutboundReadModel["channelMixToday"] = {
    email: 0,
    sms: 0,
    voice_drop: 0,
    ai_voice: 0,
    video: 0,
    linkedin_manual: 0,
  }
  for (const action of todayActions.filter((row) => row.status === "completed" || row.status === "queued")) {
    channelMixToday[action.channel] += 1
  }

  return {
    readOnly: true,
    qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_BOUNDED_AUTONOMOUS_OUTBOUND_RULE,
    summary: {
      approvedScopes: approvedScopes.length,
      activeScopes: activeScopes.length,
      blockedScopes: blockedScopes.length,
      pausedScopes: pausedScopes.length,
      actionsExecutedToday: todayActions.filter((row) => row.status === "completed" || row.status === "queued").length,
      actionsBlockedToday: todayActions.filter((row) => row.status === "blocked").length,
    },
    approvedScopes,
    activeScopes,
    blockedScopes,
    recentActions: [...input.actions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 25),
    stopConditionTriggers: input.stopConditionTriggers,
    killSwitchStatus: input.killSwitchStatus,
    channelMixToday,
    lastEventAt: input.lastEventAt,
    lastEventType: input.lastEventType,
  }
}

export function selectEligibleOutboundAction(input: {
  scope: GrowthAutonomousOutboundScope
  pendingActions: Array<{
    actionType: GrowthAutonomousOutboundActionType
    leadId: string
    sequenceJobId?: string | null
  }>
  gateEvaluator: (candidate: {
    channel: GrowthAutonomousOutboundChannel
    leadId: string
  }) => GrowthAutonomousOutboundGateEvaluation
}): {
  selected: (typeof input.pendingActions)[number] | null
  evaluation: GrowthAutonomousOutboundGateEvaluation | null
} {
  for (const candidate of input.pendingActions) {
    const channel = mapActionTypeToChannel(candidate.actionType)
    const evaluation = input.gateEvaluator({ channel, leadId: candidate.leadId })
    if (evaluation.allowed) {
      return { selected: candidate, evaluation }
    }
  }
  const first = input.pendingActions[0]
  if (!first) return { selected: null, evaluation: null }
  const channel = mapActionTypeToChannel(first.actionType)
  return {
    selected: null,
    evaluation: input.gateEvaluator({ channel, leadId: first.leadId }),
  }
}
