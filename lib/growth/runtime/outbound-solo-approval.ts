import "server-only"

import {
  describeGrowthOutboundSoloApprovalGate,
  parseGrowthOutboundSoloAutoApprove,
} from "@/lib/growth/runtime/outbound-solo-approval-types"
import { getGrowthOutboundMode } from "@/lib/growth/runtime/outbound-mode"

export {
  GROWTH_OUTBOUND_SOLO_AUTO_APPROVE_ENV,
  parseGrowthOutboundSoloAutoApprove,
  describeGrowthOutboundSoloApprovalGate,
} from "@/lib/growth/runtime/outbound-solo-approval-types"

export function isGrowthOutboundSoloAutoApproveEnabled(): boolean {
  return parseGrowthOutboundSoloAutoApprove(process.env.GROWTH_OUTBOUND_SOLO_AUTO_APPROVE)
}

/** Solo unified approval is allowed only in standalone mode with env flag (platform admin checked at route layer). */
export function canUseGrowthOutboundSoloApproval(input?: {
  platformAdmin?: boolean
}): boolean {
  const gate = describeGrowthOutboundSoloApprovalGate({
    outboundMode: getGrowthOutboundMode(),
    soloAutoApprove: isGrowthOutboundSoloAutoApproveEnabled(),
    platformAdmin: input?.platformAdmin ?? true,
  })
  return gate.enabled
}
