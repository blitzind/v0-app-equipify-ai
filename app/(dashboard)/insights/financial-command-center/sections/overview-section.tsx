"use client"

import { BlitzpayFccExecutiveOverview } from "@/components/blitzpay/blitzpay-fcc-executive-overview"
import { BlitzpayRelatedPaymentSettingsCollapsible } from "@/components/blitzpay/blitzpay-related-payment-settings-collapsible"
import { FCC_OVERVIEW_PAGE_STACK } from "@/lib/navigation-chrome"

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function OverviewSection({ organizationId, orgReady }: Props) {
  return (
    <div className={FCC_OVERVIEW_PAGE_STACK}>
      <BlitzpayFccExecutiveOverview organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayRelatedPaymentSettingsCollapsible />
    </div>
  )
}
