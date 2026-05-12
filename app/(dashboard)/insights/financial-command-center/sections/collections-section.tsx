"use client"

import { BlitzpayCollectionsCopilotPanel } from "@/components/blitzpay/blitzpay-collections-copilot-panel"
import { BlitzpayCollectionsEnginePanel } from "@/components/blitzpay/blitzpay-collections-engine-panel"
import type { BlitzpayFccOrgProps } from "../fcc-org-props"

export default function CollectionsSection({ organizationId, orgReady }: BlitzpayFccOrgProps) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <BlitzpayCollectionsCopilotPanel organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayCollectionsEnginePanel organizationId={organizationId} orgReady={orgReady} />
    </div>
  )
}
