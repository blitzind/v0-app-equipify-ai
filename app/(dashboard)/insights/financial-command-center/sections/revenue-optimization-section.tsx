"use client"

import { BlitzpayRevenueIntelligencePanel } from "@/components/blitzpay/blitzpay-revenue-intelligence-panel"
import { BlitzpayRevenueOptimizationPanel } from "@/components/blitzpay/blitzpay-revenue-optimization-panel"
import type { BlitzpayFccOrgProps } from "../fcc-org-props"

export default function RevenueOptimizationSection({ organizationId, orgReady }: BlitzpayFccOrgProps) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <BlitzpayRevenueIntelligencePanel organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayRevenueOptimizationPanel organizationId={organizationId} orgReady={orgReady} />
    </div>
  )
}
