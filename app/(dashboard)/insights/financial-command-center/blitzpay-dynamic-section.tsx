"use client"

import dynamic from "next/dynamic"
import type { BlitzpayFccOrgProps } from "./fcc-org-props"
import { OverviewSection } from "./sections/overview-section"

function SectionSkeleton() {
  return (
    <div
      className="rounded-xl border border-border bg-muted/15 p-8 min-h-[200px] animate-pulse"
      aria-hidden
    />
  )
}

const ExecutiveHealthSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-executive-dashboard").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayExecutiveDashboard organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const AiFinancialCopilotSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-ai-financial-copilot-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayAiFinancialCopilotPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const RevenueOptimizationSection = dynamic(() => import("./sections/revenue-optimization-section"), {
  loading: SectionSkeleton,
})

const RecurringRevenueSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-recurring-revenue-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayRecurringRevenuePanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const CollectionsSection = dynamic(() => import("./sections/collections-section"), { loading: SectionSkeleton })

const BillingProfilesSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-billing-profiles-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayBillingProfilesPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const CommandCenterDataSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-financial-command-center-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayFinancialCommandCenterPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const MultiEntityFinanceSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-multi-entity-finance-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayMultiEntityFinancePanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const SupplierNetworkSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-supplier-network-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpaySupplierNetworkPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const ClaimsProtectionSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-claims-protection-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayClaimsProtectionPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const MobileFinancialOpsSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-mobile-financial-ops-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayMobileFinancialOpsPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const EnterpriseObservabilitySection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-enterprise-observability-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayEnterpriseObservabilityPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const InternalBooksSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-accounting-overview-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayAccountingOverviewPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const VendorBillsSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-ap-bill-pay-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayApBillPayPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const TaxComplianceSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-tax-compliance-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayTaxCompliancePanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const FinancingMarketplaceSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-financing-marketplace-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayFinancingMarketplacePanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const ProcurementInventorySection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-procurement-inventory-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayProcurementInventoryPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const OperatingCashSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-cash-accounts-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayCashAccountsPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

const PayrollCommissionsSection = dynamic(() => import("./sections/payroll-commissions-section"), {
  loading: SectionSkeleton,
})

const ContractorSettlementsSection = dynamic(
  () =>
    import("@/components/blitzpay/blitzpay-vendor-payouts-panel").then((m) => ({
      default: function Section(p: BlitzpayFccOrgProps) {
        return <m.BlitzpayVendorPayoutsPanel organizationId={p.organizationId} orgReady={p.orgReady} />
      },
    })),
  { loading: SectionSkeleton },
)

type Props = BlitzpayFccOrgProps & { slug: string }

export function BlitzpayDynamicSection({ slug, organizationId, orgReady }: Props) {
  const orgProps: BlitzpayFccOrgProps = { organizationId, orgReady }

  switch (slug) {
    case "overview":
      return <OverviewSection organizationId={organizationId} orgReady={orgReady} />
    case "executive-health":
      return <ExecutiveHealthSection {...orgProps} />
    case "ai-financial-copilot":
      return <AiFinancialCopilotSection {...orgProps} />
    case "revenue-optimization":
      return <RevenueOptimizationSection {...orgProps} />
    case "recurring-revenue":
      return <RecurringRevenueSection {...orgProps} />
    case "collections":
      return <CollectionsSection {...orgProps} />
    case "billing-profiles":
      return <BillingProfilesSection {...orgProps} />
    case "command-center-data":
      return <CommandCenterDataSection {...orgProps} />
    case "multi-entity-finance":
      return <MultiEntityFinanceSection {...orgProps} />
    case "supplier-network":
      return <SupplierNetworkSection {...orgProps} />
    case "claims-protection":
      return <ClaimsProtectionSection {...orgProps} />
    case "mobile-financial-ops":
      return <MobileFinancialOpsSection {...orgProps} />
    case "enterprise-observability":
      return <EnterpriseObservabilitySection {...orgProps} />
    case "internal-books":
      return <InternalBooksSection {...orgProps} />
    case "vendor-bills":
      return <VendorBillsSection {...orgProps} />
    case "tax-compliance":
      return <TaxComplianceSection {...orgProps} />
    case "financing-marketplace":
      return <FinancingMarketplaceSection {...orgProps} />
    case "procurement-inventory":
      return <ProcurementInventorySection {...orgProps} />
    case "operating-cash":
      return <OperatingCashSection {...orgProps} />
    case "payroll-commissions":
      return <PayrollCommissionsSection {...orgProps} />
    case "contractor-settlements":
      return <ContractorSettlementsSection {...orgProps} />
    default:
      return null
  }
}

/**
 * Chunk-only prefetch (mirrors `dynamic()` targets above). Warms bundles without mounting.
 */
export const BLITZPAY_FCC_CHUNK_PREFETCH_BY_SLUG: Partial<Record<string, () => Promise<unknown>>> = {
  "executive-health": () => import("@/components/blitzpay/blitzpay-executive-dashboard"),
  "ai-financial-copilot": () => import("@/components/blitzpay/blitzpay-ai-financial-copilot-panel"),
  "revenue-optimization": () => import("./sections/revenue-optimization-section"),
  "recurring-revenue": () => import("@/components/blitzpay/blitzpay-recurring-revenue-panel"),
  collections: () => import("./sections/collections-section"),
  "billing-profiles": () => import("@/components/blitzpay/blitzpay-billing-profiles-panel"),
  "command-center-data": () => import("@/components/blitzpay/blitzpay-financial-command-center-panel"),
  "multi-entity-finance": () => import("@/components/blitzpay/blitzpay-multi-entity-finance-panel"),
  "supplier-network": () => import("@/components/blitzpay/blitzpay-supplier-network-panel"),
  "claims-protection": () => import("@/components/blitzpay/blitzpay-claims-protection-panel"),
  "mobile-financial-ops": () => import("@/components/blitzpay/blitzpay-mobile-financial-ops-panel"),
  "enterprise-observability": () => import("@/components/blitzpay/blitzpay-enterprise-observability-panel"),
  "internal-books": () => import("@/components/blitzpay/blitzpay-accounting-overview-panel"),
  "vendor-bills": () => import("@/components/blitzpay/blitzpay-ap-bill-pay-panel"),
  "tax-compliance": () => import("@/components/blitzpay/blitzpay-tax-compliance-panel"),
  "financing-marketplace": () => import("@/components/blitzpay/blitzpay-financing-marketplace-panel"),
  "procurement-inventory": () => import("@/components/blitzpay/blitzpay-procurement-inventory-panel"),
  "operating-cash": () => import("@/components/blitzpay/blitzpay-cash-accounts-panel"),
  "payroll-commissions": () => import("./sections/payroll-commissions-section"),
  "contractor-settlements": () => import("@/components/blitzpay/blitzpay-vendor-payouts-panel"),
}

export function prefetchBlitzpayFccSectionChunk(slug: string): Promise<unknown> | null {
  const fn = BLITZPAY_FCC_CHUNK_PREFETCH_BY_SLUG[slug]
  return fn ? fn() : null
}
