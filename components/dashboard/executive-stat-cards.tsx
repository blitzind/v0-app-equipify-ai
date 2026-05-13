"use client"

import {
  CalendarClock,
  AlertCircle,
  ClipboardList,
  DollarSign,
  Shield,
  Repeat2,
  FileWarning,
  ListTodo,
  CheckCircle2,
  ScrollText,
  UserRoundX,
  ListChecks,
} from "lucide-react"
import type { UseFirstRunReturn } from "@/hooks/use-first-run"
import type { DashboardStats } from "@/lib/dashboard/use-supabase-dashboard"
import { StatCard } from "@/components/dashboard/stat-card"
import { resolveStatCardOrder } from "@/lib/onboarding-industry/resolve-onboarding-industry-bundle"
import type { ExecutiveStatCardId } from "@/lib/onboarding-industry/types"

function formatUsdFromCents(cents: number): string {
  const dollars = Math.round(cents / 100)
  return `$${dollars.toLocaleString()}`
}

function renderStatCard(
  id: ExecutiveStatCardId,
  args: {
    stats: DashboardStats
    loading: boolean
    showQuotesExecutive: boolean
    monthlyRevenueLabel: string
  },
) {
  const { stats, loading, showQuotesExecutive, monthlyRevenueLabel } = args
  switch (id) {
    case "equipment_due_this_month":
      return (
        <StatCard
          key={id}
          title="Equipment Due This Month"
          value={stats.equipmentDueThisMonth}
          subtitle="Scheduled for service"
          icon={CalendarClock}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          href="/service-schedule"
          loading={loading}
        />
      )
    case "overdue_service":
      return (
        <StatCard
          key={id}
          title="Overdue Service"
          value={stats.overdueService}
          subtitle="Immediate attention needed"
          icon={AlertCircle}
          iconColor="text-destructive"
          iconBg="bg-destructive/10"
          urgent
          href="/service-schedule"
          loading={loading}
        />
      )
    case "open_work_orders":
      return (
        <StatCard
          key={id}
          title="Open Work Orders"
          value={stats.openWorkOrders}
          subtitle="Across all technicians"
          icon={ClipboardList}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          href="/work-orders"
          loading={loading}
        />
      )
    case "monthly_revenue":
      return (
        <StatCard
          key={id}
          title="Monthly Revenue"
          value={monthlyRevenueLabel}
          subtitle="Completed & invoiced this month"
          icon={DollarSign}
          iconColor="text-[oklch(0.42_0.17_145)]"
          iconBg="bg-[oklch(0.62_0.17_145)]/10"
          href="/reports"
          loading={loading}
        />
      )
    case "expiring_warranties":
      return (
        <StatCard
          key={id}
          title="Expiring Warranties"
          value={stats.expiringWarrantiesCount}
          subtitle="Within 30 days"
          icon={Shield}
          iconColor="text-[oklch(0.50_0.12_70)]"
          iconBg="bg-[oklch(0.75_0.16_70)]/10"
          href="/equipment"
          loading={loading}
        />
      )
    case "repeat_repairs":
      return (
        <StatCard
          key={id}
          title="Repeat Repair Alerts"
          value={stats.repeatRepairAlertsCount}
          subtitle="Assets with 2+ WOs in 90 days"
          icon={Repeat2}
          iconColor="text-destructive"
          iconBg="bg-destructive/10"
          urgent
          href="/work-orders"
          loading={loading}
        />
      )
    case "overdue_invoices":
      return (
        <StatCard
          key={id}
          title="Overdue Invoices"
          value={stats.overdueInvoicesCount}
          subtitle={
            stats.overdueInvoicesAmountCents > 0
              ? `${formatUsdFromCents(stats.overdueInvoicesAmountCents)} outstanding`
              : "Past due date"
          }
          icon={FileWarning}
          iconColor="text-[color:var(--status-warning)]"
          iconBg="bg-[color:var(--status-warning)]/10"
          urgent={stats.overdueInvoicesCount > 0}
          href="/invoices"
          loading={loading}
        />
      )
    case "pm_plans_overdue":
      return (
        <StatCard
          key={id}
          title="PM Plans Overdue"
          value={stats.maintenancePlansOverdueCount}
          subtitle="Active plans past next due"
          icon={ListTodo}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          urgent={stats.maintenancePlansOverdueCount > 0}
          href="/maintenance-plans"
          loading={loading}
        />
      )
    case "completed_this_month":
      return (
        <StatCard
          key={id}
          title="Completed This Month"
          value={stats.workOrdersCompletedThisMonth}
          subtitle="Completed / pending signature / invoiced (completion date in range)"
          icon={CheckCircle2}
          iconColor="text-[oklch(0.42_0.17_145)]"
          iconBg="bg-[oklch(0.62_0.17_145)]/10"
          href="/work-orders"
          loading={loading}
        />
      )
    case "quote_pipeline":
      if (!showQuotesExecutive) return null
      return (
        <StatCard
          key={id}
          title="Quote Pipeline"
          value={stats.openQuotesPipelineCount}
          subtitle="Draft, sent, or pending approval"
          icon={ScrollText}
          iconColor="text-sky-700"
          iconBg="bg-sky-500/10"
          href="/quotes"
          loading={loading}
        />
      )
    case "unassigned_open_work":
      return (
        <StatCard
          key={id}
          title="Unassigned Open Work"
          value={stats.unassignedOpenWorkOrders}
          subtitle="Open, scheduled, or in progress — no primary technician"
          icon={UserRoundX}
          iconColor="text-amber-800"
          iconBg="bg-amber-500/15"
          urgent={stats.unassignedOpenWorkOrders > 0}
          href="/dispatch"
          loading={loading}
        />
      )
    case "active_pm_plans":
      return (
        <StatCard
          key={id}
          title="Active PM Plans"
          value={stats.activeMaintenancePlansCount}
          subtitle="Contracts on file (active status)"
          icon={ListChecks}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          href="/maintenance-plans"
          loading={loading}
        />
      )
    default:
      return null
  }
}

export function ExecutiveStatCards({
  stats,
  loading,
  showQuotesExecutive,
  firstRun,
}: {
  stats: DashboardStats
  loading: boolean
  showQuotesExecutive: boolean
  firstRun: UseFirstRunReturn
}) {
  const monthlyRevenueLabel = formatUsdFromCents(stats.monthlyRevenueCents)
  const order = resolveStatCardOrder(firstRun.data?.statCardPriority ?? null)

  return (
    <>
      <div className="print:hidden">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive snapshot</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
        {order.map((id) =>
          renderStatCard(id, {
            stats,
            loading,
            showQuotesExecutive,
            monthlyRevenueLabel,
          }),
        )}
      </div>
    </>
  )
}
