"use client"

import { BlitzpayApBillPayPanel } from "@/components/blitzpay/blitzpay-ap-bill-pay-panel"
import { BlitzpayApPanel } from "@/components/blitzpay/blitzpay-ap-panel"
import type { BlitzpayFccOrgProps } from "../fcc-org-props"

/** Vendor bill pay orchestration + internal vendor payables workspace (moved from Settings → Payments). */
export default function VendorBillsSection({ organizationId, orgReady }: BlitzpayFccOrgProps) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <BlitzpayApBillPayPanel organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayApPanel organizationId={organizationId} orgReady={orgReady} />
    </div>
  )
}
