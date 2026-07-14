/** GE-AIOS-CHANNELS-1A — Server resolver for canonical package channel content. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import {
  materializeCanonicalOutreachChannelContent,
  resolveOperatorAssetOverride,
  type CanonicalOutreachMaterializedContent,
  type CanonicalOutreachTransportChannel,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"
import { GROWTH_AIOS_CHANNELS_1A_QA_MARKER } from "@/lib/growth/aios/growth/growth-channels-1a-types"

export { GROWTH_AIOS_CHANNELS_1A_QA_MARKER }

export async function resolveCanonicalChannelContentForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    channel: CanonicalOutreachTransportChannel
  },
): Promise<CanonicalOutreachMaterializedContent | null> {
  const pkg = await resolveCanonicalOutreachPackageForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  const brief = pkg?.salesStrategyBrief
  if (!brief) return null

  return materializeCanonicalOutreachChannelContent({
    brief,
    channel: input.channel,
    package: pkg,
    operatorAssetOverride: resolveOperatorAssetOverride(pkg, input.channel),
  })
}
