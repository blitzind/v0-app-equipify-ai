"use client"

import { formatOutboundIdentityPreviewLabel } from "@/lib/growth/signatures/outbound-identity-types"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"

export function GrowthOutboundSenderContextBadge({
  identity,
}: {
  identity:
    | {
        displayName?: string | null
        title?: string | null
      }
    | null
    | undefined
}) {
  const label = formatOutboundIdentityPreviewLabel(
    identity?.displayName
      ? { displayName: identity.displayName, title: identity.title ?? null }
      : null,
  )
  if (!label) return null
  return <GrowthBadge label={label} tone="neutral" />
}
