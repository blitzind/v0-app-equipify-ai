/** SMS context projection (Phase 5.3B). Client-safe. */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import type { SmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-personalization-types"

/** SMS-relevant context keys — excludes email-only fields like prior_subjects as primary drivers. */
export const SMS_CONTEXT_SOURCE_PRIORITY = [
  "research_pain_points",
  "website_findings",
  "outreach_angles",
  "memory",
  "prior_replies",
  "prior_touches",
  "relationship_stage",
  "objections",
  "commitments",
] as const

export function projectSmsPersonalizationContext(input: {
  packet: OutreachContextPacket
  priorSmsPreviews?: string[]
}): SmsPersonalizationContext {
  return {
    packet: input.packet,
    priorSmsPreviews: input.priorSmsPreviews ?? [],
    priorSmsCount: input.priorSmsPreviews?.length ?? 0,
    shortForm: true,
  }
}
