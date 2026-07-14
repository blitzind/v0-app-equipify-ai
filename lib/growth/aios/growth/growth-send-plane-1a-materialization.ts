/**
 * GE-AIOS-SEND-PLANE-1A — Canonical draft materialization from Sales Strategy Brief (client-safe).
 */

import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  generateOutreachDraftsFromSalesStrategyBrief,
  type GrowthOutreachStrategyDerivedDrafts,
} from "@/lib/growth/aios/growth/growth-outreach-strategy-drafts"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  finalizeProductionCustomerFacingCopy,
  GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER,
  reviewOperatorExecutionGuideConstitution,
  reviewProductionHumanCommunicationConstitution,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-constitution"
import {
  prepareOperatorApprovedTransportBody,
  resolveTransportAssetFromPackage,
} from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"

export type CanonicalOutreachTransportChannel =
  | "email"
  | "sms"
  | "linkedin"
  | "call"
  | "voicemail"
  | "sendr"
  | "follow_up"
  | "meeting_request"

export type CanonicalOutreachMaterializedContent = {
  qaMarker: typeof GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER
  channel: CanonicalOutreachTransportChannel
  subject: string | null
  body: string
  sourcePackageId: string | null
  constitutionFailures: string[]
  transportReady: boolean
}

export function resolveCanonicalTransportChannelFromGenerationType(
  generationType: string | null | undefined,
): CanonicalOutreachTransportChannel | null {
  const type = (generationType ?? "").toLowerCase()
  if (type === "sms" || type.includes("sms")) return "sms"
  if (type === "voice_drop" || type.includes("voicemail") || type.includes("voice_drop")) return "voicemail"
  if (type.includes("linkedin")) return "linkedin"
  if (type.includes("meeting")) return "meeting_request"
  if (
    type === "call_opening" ||
    type === "call_objection_response" ||
    type === "call_summary" ||
    type === "call_risk_brief" ||
    type.includes("call_")
  ) {
    return "call"
  }
  if (type.includes("sendr") || type.includes("personalized_video") || type.includes("personalized video")) {
    return "sendr"
  }
  if (type === "follow_up" || type.includes("follow_up")) return "follow_up"
  if (
    type === "cold_email" ||
    type === "follow_up_email" ||
    type === "reply_email" ||
    type === "response_draft" ||
    type === "reengagement_email" ||
    type === "executive_email" ||
    type === "breakup_email" ||
    type === "next_message" ||
    type.includes("email")
  ) {
    return "email"
  }
  return null
}

export function materializeCanonicalOutreachDrafts(input: {
  brief: GrowthOutreachSalesStrategyBrief
  senderName?: string | null
  packageId?: string | null
}): GrowthOutreachStrategyDerivedDrafts {
  return generateOutreachDraftsFromSalesStrategyBrief({
    brief: input.brief,
    senderName: input.senderName,
  })
}

function resolveMaterializationCanonicalIdentity(input: {
  brief: GrowthOutreachSalesStrategyBrief
  package?: GrowthAutonomousOutreachApprovalPackage | null
}) {
  return (
    input.brief.canonicalDisplayIdentity ??
    input.package?.canonicalDisplayIdentity ??
    input.package?.salesStrategyBrief?.canonicalDisplayIdentity ??
    null
  )
}

function extractEmailBodyForTransport(
  drafts: GrowthOutreachStrategyDerivedDrafts,
  canonicalIdentity: ReturnType<typeof resolveMaterializationCanonicalIdentity>,
): {
  subject: string
  body: string
} {
  const subject = finalizeProductionCustomerFacingCopy(drafts.email.subject, canonicalIdentity)
  const body = finalizeProductionCustomerFacingCopy(drafts.email.body, canonicalIdentity)
  return { subject, body }
}

function extractFollowUpBodyForTransport(
  drafts: GrowthOutreachStrategyDerivedDrafts,
  canonicalIdentity: ReturnType<typeof resolveMaterializationCanonicalIdentity>,
): string {
  return finalizeProductionCustomerFacingCopy(drafts.followUpSequence, canonicalIdentity)
}

export function materializeCanonicalOutreachChannelContent(input: {
  brief: GrowthOutreachSalesStrategyBrief
  channel: CanonicalOutreachTransportChannel
  senderName?: string | null
  package?: GrowthAutonomousOutreachApprovalPackage | null
  operatorAssetOverride?: string | null
}): CanonicalOutreachMaterializedContent {
  const companyName = input.brief.companyName
  const canonicalIdentity = resolveMaterializationCanonicalIdentity(input)
  const packageAsset = resolveTransportAssetFromPackage(
    input.package,
    input.channel,
    companyName,
    canonicalIdentity,
  )

  if (packageAsset) {
    const isApproved = packageAsset.source === "approved_operator"
    const rawBody = packageAsset.body
    const rawSubject = packageAsset.subject

    const body = isApproved
      ? prepareOperatorApprovedTransportBody(rawBody)
      : finalizeProductionCustomerFacingCopy(rawBody, canonicalIdentity)
    const subject = rawSubject
      ? isApproved
        ? prepareOperatorApprovedTransportBody(rawSubject)
        : finalizeProductionCustomerFacingCopy(rawSubject, canonicalIdentity)
      : null

    const constitutionFailures = isApproved
      ? []
      : [
          ...(input.channel === "call"
            ? reviewOperatorExecutionGuideConstitution(body, canonicalIdentity)
            : reviewProductionHumanCommunicationConstitution(body, companyName, canonicalIdentity)),
          ...(subject
            ? input.channel === "call"
              ? reviewOperatorExecutionGuideConstitution(subject, canonicalIdentity)
              : reviewProductionHumanCommunicationConstitution(subject, companyName, canonicalIdentity)
            : []),
        ]

    return {
      qaMarker: GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER,
      channel: input.channel,
      subject,
      body,
      sourcePackageId: input.package?.packageId ?? null,
      constitutionFailures,
      transportReady: (isApproved || constitutionFailures.length === 0) && body.length > 0,
    }
  }

  const drafts = materializeCanonicalOutreachDrafts({
    brief: input.brief,
    senderName: input.senderName,
    packageId: input.package?.packageId ?? null,
  })

  let subject: string | null = null
  let rawBody = ""

  switch (input.channel) {
    case "email": {
      const email = extractEmailBodyForTransport(drafts, canonicalIdentity)
      subject = email.subject
      rawBody = email.body
      break
    }
    case "sms":
      rawBody = drafts.sms
      break
    case "linkedin":
      rawBody = drafts.linkedIn
      break
    case "call":
      rawBody = drafts.callGuide
      break
    case "voicemail":
      rawBody = drafts.voicemail
      break
    case "sendr":
      rawBody = drafts.personalizedVideo
      break
    case "follow_up":
      rawBody = extractFollowUpBodyForTransport(drafts, canonicalIdentity)
      break
    case "meeting_request":
      rawBody = drafts.meetingRequest
      break
  }

  if (input.operatorAssetOverride?.trim()) {
    rawBody = input.operatorAssetOverride.trim()
  }

  const body = finalizeProductionCustomerFacingCopy(rawBody, canonicalIdentity)
  if (subject) {
    subject = finalizeProductionCustomerFacingCopy(subject, canonicalIdentity)
  }

  const constitutionFailures = [
    ...(input.channel === "call"
      ? reviewOperatorExecutionGuideConstitution(body, canonicalIdentity)
      : reviewProductionHumanCommunicationConstitution(body, companyName, canonicalIdentity)),
    ...(subject
      ? input.channel === "call"
        ? reviewOperatorExecutionGuideConstitution(subject, canonicalIdentity)
        : reviewProductionHumanCommunicationConstitution(subject, companyName, canonicalIdentity)
      : []),
  ]

  return {
    qaMarker: GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER,
    channel: input.channel,
    subject,
    body,
    sourcePackageId: input.package?.packageId ?? null,
    constitutionFailures,
    transportReady: constitutionFailures.length === 0 && body.length > 0,
  }
}

export function resolveOperatorAssetOverride(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
  channel: CanonicalOutreachTransportChannel,
): string | null {
  const resolved = resolveTransportAssetFromPackage(pkg, channel, pkg?.companyName ?? "")
  if (!resolved) return null
  if (channel === "email") {
    return resolved.subject ? `Subject: ${resolved.subject}\n\n${resolved.body}` : resolved.body
  }
  return resolved.body
}

export function hasCanonicalSalesStrategyBriefPackage(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
): boolean {
  return Boolean(pkg?.salesStrategyBrief?.leadId && pkg.salesStrategyBrief.companyName)
}
