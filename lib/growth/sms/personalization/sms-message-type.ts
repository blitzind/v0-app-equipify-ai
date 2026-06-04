/** SMS message type inference (Phase 5.3B). Client-safe. */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import type { SmsMessageType } from "@/lib/growth/sms/personalization/sms-personalization-types"

export function inferSmsMessageType(input: {
  packet: OutreachContextPacket
  draftType?: "outbound" | "reply"
  priorSmsCount?: number
}): SmsMessageType {
  if (input.draftType === "reply") return "sms_reply"

  const stage = input.packet.relationshipStage?.toLowerCase() ?? ""
  if (stage === "customer" || stage === "opportunity") return "customer_check_in_sms"

  if (input.packet.priorReplySummaries.length > 0 || (input.priorSmsCount ?? 0) > 0) {
    return "follow_up_sms"
  }

  if (input.packet.priorTouchCount >= 2 && !input.packet.priorReplySummaries.length) {
    return "reengagement_sms"
  }

  return "cold_sms"
}
