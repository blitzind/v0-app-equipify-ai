"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { BlitzpayCollectionsEnginePanel } from "@/components/blitzpay/blitzpay-collections-engine-panel"
import { BlitzpayBillingProfilesPanel } from "@/components/blitzpay/blitzpay-billing-profiles-panel"
import { BlitzpayCollectionsCopilotPanel } from "@/components/blitzpay/blitzpay-collections-copilot-panel"
import { BlitzpayRecurringRevenuePanel } from "@/components/blitzpay/blitzpay-recurring-revenue-panel"
import { BlitzpayExecutiveDashboard } from "@/components/blitzpay/blitzpay-executive-dashboard"
import { BlitzpayAiFinancialCopilotPanel } from "@/components/blitzpay/blitzpay-ai-financial-copilot-panel"
import { BlitzpayRevenueOptimizationPanel } from "@/components/blitzpay/blitzpay-revenue-optimization-panel"
import { BlitzpayFinancialCommandCenterPanel } from "@/components/blitzpay/blitzpay-financial-command-center-panel"
import { BlitzpayAccountingOverviewPanel } from "@/components/blitzpay/blitzpay-accounting-overview-panel"
import { BlitzpayApBillPayPanel } from "@/components/blitzpay/blitzpay-ap-bill-pay-panel"
import { BlitzpayTaxCompliancePanel } from "@/components/blitzpay/blitzpay-tax-compliance-panel"
import { BlitzpayFinancingMarketplacePanel } from "@/components/blitzpay/blitzpay-financing-marketplace-panel"
import { BlitzpayMultiEntityFinancePanel } from "@/components/blitzpay/blitzpay-multi-entity-finance-panel"
import { BlitzpaySupplierNetworkPanel } from "@/components/blitzpay/blitzpay-supplier-network-panel"
import { BlitzpayClaimsProtectionPanel } from "@/components/blitzpay/blitzpay-claims-protection-panel"
import { BlitzpayMobileFinancialOpsPanel } from "@/components/blitzpay/blitzpay-mobile-financial-ops-panel"
import { BlitzpayProcurementInventoryPanel } from "@/components/blitzpay/blitzpay-procurement-inventory-panel"
import { BlitzpayPayrollDashboard } from "@/components/blitzpay/blitzpay-payroll-dashboard"
import { BlitzpayCommissionQueue } from "@/components/blitzpay/blitzpay-commission-queue"
import { BlitzpayVendorPayoutsPanel } from "@/components/blitzpay/blitzpay-vendor-payouts-panel"
import { BlitzpayCashAccountsPanel } from "@/components/blitzpay/blitzpay-cash-accounts-panel"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"

export default function FinancialCommandCenterPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions, status: permStatus } = useOrgPermissions()

  const canView =
    permStatus === "ready" && (permissions.canViewFinancialReports || permissions.canViewFinancials)

  if (!canView) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] flex gap-3">
          <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)] shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Financial command center is restricted</p>
            <p className="text-muted-foreground leading-relaxed">
              You need financial reports or financials access to view BlitzPay cash, AR, AP, and treasury signals.
            </p>
            <Link href="/settings/permissions" className="text-primary font-medium underline-offset-2 hover:underline">
              Review permissions
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
        The same command center lives under{" "}
        <Link href="/settings/payments#blitzpay-financial-command-center-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments
        </Link>
        . Executive business health (deterministic, no AI) is at{" "}
        <Link href="/settings/payments#blitzpay-executive-dashboard-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Executive business health
        </Link>
        . Collections copilot:{" "}
        <Link href="/settings/payments#blitzpay-collections-copilot-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Collections copilot
        </Link>
        . Recurring revenue:{" "}
        <Link href="/settings/payments#blitzpay-recurring-revenue-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Recurring revenue
        </Link>
        . Payroll accruals:{" "}
        <Link href="/settings/payments#blitzpay-payroll-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Payroll
        </Link>
        . Internal books (trial balance & chart):{" "}
        <Link href="/settings/payments#blitzpay-accounting-overview-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Internal books
        </Link>
        . Vendor bills & pay planning:{" "}
        <Link href="/settings/payments#blitzpay-ap-bill-pay-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Vendor bills & pay planning
        </Link>
        . Tax & compliance:{" "}
        <Link href="/settings/payments#blitzpay-tax-compliance-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Tax & compliance
        </Link>
        . Financing marketplace:{" "}
        <Link href="/settings/payments#blitzpay-financing-marketplace-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Financing marketplace
        </Link>
        . Procurement &amp; inventory finance:{" "}
        <Link href="/settings/payments#blitzpay-procurement-inventory-anchor" className="text-primary underline-offset-2 hover:underline">
          Settings → Payments → Procurement &amp; inventory finance
        </Link>
        .
      </p>
      <BlitzpayExecutiveDashboard organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayAiFinancialCopilotPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayRevenueOptimizationPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayRecurringRevenuePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayCollectionsCopilotPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayCollectionsEnginePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayBillingProfilesPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayFinancialCommandCenterPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayMultiEntityFinancePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpaySupplierNetworkPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayClaimsProtectionPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayMobileFinancialOpsPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayAccountingOverviewPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayApBillPayPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayTaxCompliancePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayFinancingMarketplacePanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayProcurementInventoryPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayCashAccountsPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayPayrollDashboard organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayCommissionQueue organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayVendorPayoutsPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
    </div>
  )
}
