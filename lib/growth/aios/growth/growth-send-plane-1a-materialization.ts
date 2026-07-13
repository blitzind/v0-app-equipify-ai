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
  if (type === "voice_drop" || type.includes("voicemail") || type.includes("voice")) return "voicemail"
  if (type.includes("linkedin")) return "linkedin"
  if (type.includes("meeting")) return "meeting_request"
  if (
    type === "cold_email" ||
    type === "follow_up_email" ||
    type === "reply_email" ||
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

function extractEmailBodyForTransport(drafts: GrowthOutreachStrategyDerivedDrafts): {
  subject: string
  body: string
} {
  const subject = finalizeProductionCustomerFacingCopy(drafts.email.subject)
  const body = finalizeProductionCustomerFacingCopy(drafts.email.body)
  return { subject, body }
}

function extractFollowUpBodyForTransport(drafts: GrowthOutreachStrategyDerivedDrafts): string {
  return finalizeProductionCustomerFacingCopy(drafts.followUpSequence)
}

export function materializeCanonicalOutreachChannelContent(input: {
  brief: GrowthOutreachSalesStrategyBrief
  channel: CanonicalOutreachTransportChannel
  senderName?: string | null
  package?: GrowthAutonomousOutreachApprovalPackage | null
  operatorAssetOverride?: string | null
}): CanonicalOutreachMaterializedContent {
  const companyName = input.brief.companyName
  const packageAsset = resolveTransportAssetFromPackage(input.package, input.channel, companyName)

  if (packageAsset) {
    const isApproved = packageAsset.source === "approved_operator"
    const rawBody = packageAsset.body
    const rawSubject = packageAsset.subject

    const body = isApproved
      ? prepareOperatorApprovedTransportBody(rawBody)
      : finalizeProductionCustomerFacingCopy(rawBody)
    const subject = rawSubject
      ? isApproved
        ? prepareOperatorApprovedTransportBody(rawSubject)
        : finalizeProductionCustomerFacingCopy(rawSubject)
      : null

    const constitutionFailures = isApproved
      ? []
      : [
          ...reviewProductionHumanCommunicationConstitution(body, companyName),
          ...(subject ? reviewProductionHumanCommunicationConstitution(subject, companyName) : []),
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
      const email = extractEmailBodyForTransport(drafts)
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
      rawBody = extractFollowUpBodyForTransport(drafts)
      break
    case "meeting_request":
      rawBody = drafts.meetingRequest
      break
  }

  if (input.operatorAssetOverride?.trim()) {
    rawBody = input.operatorAssetOverride.trim()
  }

  const body = finalizeProductionCustomerFacingCopy(rawBody)
  if (subject) {
    subject = finalizeProductionCustomerFacingCopy(subject)
  }

  const constitutionFailures = [
    ...reviewProductionHumanCommunicationConstitution(body, companyName),
    ...(subject ? reviewProductionHumanCommunicationConstitution(subject, companyName) : []),
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
