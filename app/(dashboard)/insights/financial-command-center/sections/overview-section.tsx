"use client"

import { BlitzpayFccExecutiveOverview } from "@/components/blitzpay/blitzpay-fcc-executive-overview"
import { BlitzpayRelatedPaymentSettingsCollapsible } from "@/components/blitzpay/blitzpay-related-payment-settings-collapsible"

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function OverviewSection({ organizationId, orgReady }: Props) {
  return (
    <div className="flex flex-col gap-8 min-w-0">
      <BlitzpayFccExecutiveOverview organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayRelatedPaymentSettingsCollapsible />
    </div>
  )
}
