"use client"

import { useCallback } from "react"
import { BlitzpayFccExecutiveOverview } from "@/components/blitzpay/blitzpay-fcc-executive-overview"
import { BlitzpayRelatedPaymentSettingsCollapsible } from "@/components/blitzpay/blitzpay-related-payment-settings-collapsible"
import { useBlitzPayCapabilities } from "@/hooks/use-blitzpay-capabilities"
import type { BlitzPayFccSectionId } from "@/lib/blitzpay/sections"
import { FCC_OVERVIEW_PAGE_STACK } from "@/lib/navigation-chrome"

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function OverviewSection({ organizationId, orgReady }: Props) {
  const { billingReady, commercialTier, fccSectionAllowsDataLoad } = useBlitzPayCapabilities()
  const fccHrefAllowed = useCallback(
    (slug?: string) => {
      if (!slug) return true
      if (!billingReady) return true
      return fccSectionAllowsDataLoad(slug as BlitzPayFccSectionId)
    },
    [billingReady, fccSectionAllowsDataLoad],
  )

  return (
    <div className={FCC_OVERVIEW_PAGE_STACK}>
      <BlitzpayFccExecutiveOverview
        organizationId={organizationId}
        orgReady={orgReady}
        fccHrefAllowed={fccHrefAllowed}
        commercialTier={commercialTier}
        billingReady={billingReady}
      />
      <BlitzpayRelatedPaymentSettingsCollapsible />
    </div>
  )
}
