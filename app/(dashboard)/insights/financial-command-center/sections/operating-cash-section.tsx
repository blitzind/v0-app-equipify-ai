"use client"

import { BlitzpayCashAccountsPanel } from "@/components/blitzpay/blitzpay-cash-accounts-panel"
import { BlitzpayPayoutLedgerWorkspace } from "@/components/blitzpay/blitzpay-payout-ledger-workspace"
import { BlitzpayTreasuryPanel } from "@/components/blitzpay/blitzpay-treasury-panel"
import type { BlitzpayFccOrgProps } from "../fcc-org-props"

/** Operating cash planning + contractor treasury + payout ledger (moved from Settings → Payments). */
export default function OperatingCashSection({ organizationId, orgReady }: BlitzpayFccOrgProps) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <BlitzpayCashAccountsPanel organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayTreasuryPanel organizationId={organizationId} orgReady={orgReady} />
      <BlitzpayPayoutLedgerWorkspace organizationId={organizationId} orgReady={orgReady} />
    </div>
  )
}
