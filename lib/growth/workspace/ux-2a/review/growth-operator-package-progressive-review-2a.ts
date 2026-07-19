/**
 * GE-AIOS-OPERATOR-UX-2A — Progressive package review presentation (client-safe).
 * Reuses Approvals2AOperatorReviewPacket — no duplicate package projection.
 */

import type {
  Approvals2ADraftChannel,
  Approvals2ADraftSlot,
  Approvals2AOperatorReviewPacket,
} from "@/lib/growth/aios/approvals/approvals-operator-review-packet"

export const GROWTH_OPERATOR_PACKAGE_PROGRESSIVE_REVIEW_2A_QA_MARKER =
  "ge-aios-operator-ux-2a-progressive-package-review-v1" as const

export type OperatorPackageChannelContentState =
  | "prepared"
  | "missing"
  | "not_applicable"
  | "unsupported"

export type OperatorPackageChannelContactState =
  | "ready"
  | "contact_missing"
  | "not_required"
  | "not_applicable"

export type OperatorPackageChannelTransportState = "transport_unavailable" | "transport_ready" | "not_applicable"

export type OperatorPackageChannelReadinessRow = {
  channel: Approvals2ADraftChannel
  label: string
  content: OperatorPackageChannelContentState
  contact: OperatorPackageChannelContactState
  transport: OperatorPackageChannelTransportState
  operatorLabel: string
  detail: string | null
}

export type OperatorPackageDecisionSummary = {
  qaMarker: typeof GROWTH_OPERATOR_PACKAGE_PROGRESSIVE_REVIEW_2A_QA_MARKER
  companyName: string
  companyContext: string | null
  recommendedAngle: string
  confidenceLabel: string
  confidencePercent: number
  fitReasons: string[]
  buyingSignals: string[]
  riskStatement: string | null
  contactName: string | null
  contactRole: string | null
  contactConfidenceLabel: string | null
  contactWarning: string | null
  channelReadiness: OperatorPackageChannelReadinessRow[]
  preparedChannelLabels: string[]
  primaryEmailDraft: Approvals2ADraftSlot | null
  secondaryPreparedDrafts: Approvals2ADraftSlot[]
  contentReadySummary: string
  contactReadySummary: string
  transportSummary: string
}

function uniqueLines(lines: Array<string | null | undefined>, limit = 6): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line?.trim()
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue
    seen.add(trimmed.toLowerCase())
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

function isUnknownClassification(value: string | null | undefined): boolean {
  if (!value?.trim()) return true
  return /^(unknown|not classified|unclassified|n\/a|none)$/i.test(value.trim())
}

export function sanitizeOperatorReviewCopy(text: string | null | undefined): string | null {
  const trimmed = text?.trim()
  if (!trimmed) return null

  if (/looks like unknown/i.test(trimmed)) return null

  const looksLikeUnknown = trimmed.match(
    /^(.+?)\s+looks like\s+([^.(]+?)(?:\s*\(\s*\d+\s*%\s*confidence\s*\))?[.]?$/i,
  )
  if (looksLikeUnknown && isUnknownClassification(looksLikeUnknown[2])) {
    return null
  }

  let normalized = trimmed
    .replace(/\(\s*\d+\s*%\s*confidence\s*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (!normalized || normalized.length < 12) return null
  return normalized.endsWith(".") ? normalized : `${normalized}.`
}

export function formatOperatorConfidenceLabel(confidence: number): string {
  const percent = Math.round(Math.max(0, Math.min(1, confidence)) * 100)
  if (percent >= 70) return `Strong opportunity confidence (${percent}%)`
  if (percent >= 50) return `Moderate opportunity confidence (${percent}%)`
  return `Limited opportunity confidence (${percent}%)`
}

export function resolveOperatorOpportunitySummary(input: {
  companyName: string
  confidence: number
  executiveSummary?: string | null
  primaryHook?: string | null
  whyPursue?: string | null
  fitReason?: string | null
  revenueEssentials?: string[]
}): string {
  for (const candidate of [
    input.executiveSummary,
    input.primaryHook,
    input.whyPursue,
    input.fitReason,
    input.revenueEssentials?.[0] ?? null,
  ]) {
    const sanitized = sanitizeOperatorReviewCopy(candidate)
    if (sanitized) return sanitized
  }

  if (input.confidence < 0.5) {
    return `Ava found limited evidence about ${input.companyName}'s immediate buying intent. Review the supporting research before authorizing.`
  }

  return `Ava recommends a focused conversation with ${input.companyName} based on the research gathered so far.`
}

function channelRequiresPhone(channel: Approvals2ADraftChannel): boolean {
  return channel === "call" || channel === "voicemail" || channel === "sms"
}

function channelRequiresEmail(channel: Approvals2ADraftChannel): boolean {
  return channel === "email" || channel === "meeting_request"
}

function channelRequiresLinkedIn(channel: Approvals2ADraftChannel): boolean {
  return channel === "linkedin"
}

function contactStateForChannel(input: {
  channel: Approvals2ADraftChannel
  hasEmail: boolean
  hasPhone: boolean
  hasLinkedIn: boolean
}): OperatorPackageChannelContactState {
  if (channelRequiresPhone(input.channel)) {
    return input.hasPhone ? "ready" : "contact_missing"
  }
  if (channelRequiresEmail(input.channel)) {
    return input.hasEmail ? "ready" : "contact_missing"
  }
  if (channelRequiresLinkedIn(input.channel)) {
    return input.hasLinkedIn ? "ready" : "contact_missing"
  }
  return "not_required"
}

function operatorLabelForRow(row: OperatorPackageChannelReadinessRow): string {
  if (row.content === "prepared") {
    if (row.contact === "contact_missing") {
      return `${row.label} prepared · contact missing`
    }
    if (row.transport === "transport_unavailable") {
      return `${row.label} prepared · sending unavailable`
    }
    return `${row.label} prepared`
  }
  if (row.content === "missing") {
    if (row.contact === "contact_missing") {
      return `${row.label} unavailable · contact missing`
    }
    return `${row.label} not prepared`
  }
  if (row.content === "unsupported") return `${row.label} unsupported`
  return `${row.label} not applicable`
}

export function projectOperatorPackageChannelReadiness(input: {
  packet: Approvals2AOperatorReviewPacket
  transportExecutionReady?: boolean | null
}): OperatorPackageChannelReadinessRow[] {
  const hasEmail = Boolean(input.packet.decisionMaker.email?.trim())
  const hasPhone = Boolean(input.packet.decisionMaker.phone?.trim())
  const hasLinkedIn = Boolean(input.packet.decisionMaker.linkedIn?.trim())
  const transportReady = input.transportExecutionReady === true

  return input.packet.drafts.map((draft) => {
    const contact = contactStateForChannel({
      channel: draft.channel,
      hasEmail,
      hasPhone,
      hasLinkedIn,
    })

    const content: OperatorPackageChannelContentState = draft.prepared
      ? "prepared"
      : draft.channel === "sendr"
        ? "unsupported"
        : "missing"

    const transport: OperatorPackageChannelTransportState =
      content !== "prepared"
        ? "not_applicable"
        : transportReady
          ? "transport_ready"
          : "transport_unavailable"

    const detail =
      content === "prepared"
        ? contact === "contact_missing"
          ? "Contact information is missing for this channel."
          : draft.preview?.slice(0, 120) ?? null
        : content === "missing" && contact === "contact_missing"
          ? "Contact information is missing for this channel."
          : content === "missing"
            ? "No usable draft content was prepared for this channel."
            : null

    const row: OperatorPackageChannelReadinessRow = {
      channel: draft.channel,
      label: draft.label,
      content,
      contact,
      transport,
      operatorLabel: "",
      detail,
    }
    row.operatorLabel = operatorLabelForRow(row)
    return row
  })
}

function buildCompanyContext(packet: Approvals2AOperatorReviewPacket): string | null {
  const parts = uniqueLines([
    !isUnknownClassification(packet.company.industry)
      ? packet.company.industry
      : null,
    packet.company.location,
    packet.company.equipmentServiced[0]
      ? `Focus: ${packet.company.equipmentServiced.slice(0, 2).join(" · ")}`
      : null,
  ])
  return parts.length ? parts.join(" · ") : null
}

function buildRiskStatement(packet: Approvals2AOperatorReviewPacket): string | null {
  const confidence = packet.risk.overallConfidence
  if (confidence < 0.5) {
    return "Opportunity confidence is currently low because buyer and timing evidence are incomplete."
  }
  if (!packet.decisionMaker.email?.trim() && !packet.decisionMaker.phone?.trim()) {
    return "Contact details are incomplete — verify the buyer before relying on this outreach."
  }
  if (packet.risk.unknownFields.length > 0) {
    const fields = packet.risk.unknownFields.slice(0, 3).join(", ")
    return `Some fields remain unverified (${fields}).`
  }
  if (packet.risk.researchCompleteness !== "Research evidence present") {
    return packet.risk.researchCompleteness
  }
  return null
}

function buildContactWarning(packet: Approvals2AOperatorReviewPacket): string | null {
  if (!packet.decisionMaker.name?.trim()) {
    return "No verified contact is on file — keep outreach role-agnostic until a buyer is confirmed."
  }
  if (!packet.decisionMaker.email?.trim() && !packet.decisionMaker.phone?.trim()) {
    return "Email and phone are missing for the recommended contact."
  }
  if (!packet.decisionMaker.email?.trim()) {
    return "Email is missing for the recommended contact."
  }
  if (!packet.decisionMaker.phone?.trim()) {
    return "Phone is missing — call and SMS channels are not ready to send."
  }
  return null
}

export function projectOperatorPackageDecisionSummary(input: {
  packet: Approvals2AOperatorReviewPacket
  transportExecutionReady?: boolean | null
}): OperatorPackageDecisionSummary {
  const packet = input.packet
  const confidence = packet.risk.overallConfidence
  const channelReadiness = projectOperatorPackageChannelReadiness(input)
  const preparedRows = channelReadiness.filter((row) => row.content === "prepared")
  const preparedChannelLabels = preparedRows.map((row) => row.operatorLabel)
  const emailDraft = packet.drafts.find((row) => row.channel === "email" && row.prepared) ?? null
  const secondaryPreparedDrafts = packet.drafts.filter(
    (row) => row.prepared && row.channel !== "email",
  )

  const fitReasons = uniqueLines([
    ...packet.whySelected.slice(0, 3),
    ...packet.operatorReviewLayout.revenueStrategyEssentials.slice(0, 2),
  ], 3)

  const buyingSignals = uniqueLines([
    ...packet.knowledgeLayers.prospectTruth.slice(0, 2),
    ...packet.operatorReviewLayout.consultantDiscoveryEssentials.slice(0, 2),
    ...packet.explainability.supportingEvidence.slice(0, 2),
  ], 3)

  const contactConfidence =
    packet.decisionMaker.contactConfidence != null
      ? `${Math.round(packet.decisionMaker.contactConfidence * 100)}% contact confidence`
      : packet.decisionMaker.verificationStatus?.trim() || null

  const contentReadySummary =
    preparedChannelLabels.length > 0
      ? preparedChannelLabels.join(" · ")
      : "No channel drafts are prepared yet."

  const contactReadySummary = buildContactWarning(packet) ?? "Contact details are on file for the recommended buyer."

  const transportSummary =
    input.transportExecutionReady === true
      ? "Transport execution setup is ready, but sending remains separately gated."
      : "Outbound sending is unavailable until transport is separately approved."

  return {
    qaMarker: GROWTH_OPERATOR_PACKAGE_PROGRESSIVE_REVIEW_2A_QA_MARKER,
    companyName: packet.company.name,
    companyContext: buildCompanyContext(packet),
    recommendedAngle: resolveOperatorOpportunitySummary({
      companyName: packet.company.name,
      confidence,
      executiveSummary: packet.salesStrategy?.executiveSummary ?? packet.explainability.whyPursue,
      primaryHook: packet.salesStrategy?.primaryHook ?? null,
      whyPursue: packet.explainability.whyPursue,
      fitReason: packet.salesStrategy?.prospectTruth?.fitReason ?? null,
      revenueEssentials: packet.operatorReviewLayout.revenueStrategyEssentials,
    }),
    confidenceLabel: formatOperatorConfidenceLabel(confidence),
    confidencePercent: Math.round(confidence * 100),
    fitReasons,
    buyingSignals,
    riskStatement: buildRiskStatement(packet),
    contactName: packet.decisionMaker.name,
    contactRole: packet.decisionMaker.title,
    contactConfidenceLabel: contactConfidence,
    contactWarning: buildContactWarning(packet),
    channelReadiness,
    preparedChannelLabels,
    primaryEmailDraft: emailDraft,
    secondaryPreparedDrafts,
    contentReadySummary,
    contactReadySummary,
    transportSummary,
  }
}
