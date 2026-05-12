"use client"

import { BlitzpayPayrollDashboard } from "@/components/blitzpay/blitzpay-payroll-dashboard"
import { BlitzpayCommissionQueue } from "@/components/blitzpay/blitzpay-commission-queue"
import type { BlitzpayFccOrgProps } from "../fcc-org-props"

export default function PayrollCommissionsSection({ organizationId, orgReady }: BlitzpayFccOrgProps) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <BlitzpayPayrollDashboard organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayCommissionQueue organizationId={organizationId} orgReady={orgReady} />
    </div>
  )
}
