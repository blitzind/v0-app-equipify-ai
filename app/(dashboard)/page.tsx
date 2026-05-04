"use client"

import {
  CalendarClock,
  AlertCircle,
  ClipboardList,
  DollarSign,
  Shield,
  Repeat2,
  AlertTriangle,
} from "lucide-react"
import { useSupabaseDashboard } from "@/lib/dashboard/use-supabase-dashboard"
import { StatCard } from "@/components/dashboard/stat-card"
import { RecentWorkOrders } from "@/components/dashboard/recent-work-orders"
import { EquipmentDue } from "@/components/dashboard/equipment-due"
import { RepeatRepairs } from "@/components/dashboard/repeat-repairs"
import { ExpiringWarranties } from "@/components/dashboard/expiring-warranties"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { WorkOrderStatus } from "@/components/dashboard/work-order-status"
import { OperationalInsightsWidget } from "@/components/dashboard/ai-insights-widget"
import { MaintenanceAutomationStats } from "@/components/dashboard/maintenance-automation-stats"
import { cn } from "@/lib/utils"

function formatUsdFromCents(cents: number): string {
  const dollars = Math.round(cents / 100)
  return `$${dollars.toLocaleString()}`
}

export default function DashboardPage() {
  const {
    loading,
    error,
    stats,
    recentWorkOrders,
    equipmentDueSoon,
    expiringWarranties,
    repeatRepairs,
    revenueByMonth,
    workOrdersByStatus,
    operationalInsights,
  } = useSupabaseDashboard()

  const monthlyRevenueLabel = formatUsdFromCents(stats.monthlyRevenueCents)

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            "border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2",
          )}
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 items-stretch">
        <StatCard
          title="Equipment Due This Month"
          value={stats.equipmentDueThisMonth}
          subtitle="Scheduled for service"
          icon={CalendarClock}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          href="/service-schedule"
          loading={loading}
        />
        <StatCard
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
        <StatCard
          title="Open Work Orders"
          value={stats.openWorkOrders}
          subtitle="Across all technicians"
          icon={ClipboardList}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          href="/work-orders"
          loading={loading}
        />
        <StatCard
          title="Monthly Revenue"
          value={monthlyRevenueLabel}
          subtitle="Completed & invoiced this month"
          icon={DollarSign}
          iconColor="text-[oklch(0.42_0.17_145)]"
          iconBg="bg-[oklch(0.62_0.17_145)]/10"
          href="/reports"
          loading={loading}
        />
        <StatCard
          title="Expiring Warranties"
          value={stats.expiringWarrantiesCount}
          subtitle="Within 30 days"
          icon={Shield}
          iconColor="text-[oklch(0.50_0.12_70)]"
          iconBg="bg-[oklch(0.75_0.16_70)]/10"
          href="/equipment"
          loading={loading}
        />
        <StatCard
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
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 h-full">
          <RevenueChart data={revenueByMonth} loading={loading} error={error} />
        </div>
        <div className="h-full">
          <WorkOrderStatus slices={workOrdersByStatus} loading={loading} error={error} />
        </div>
      </div>

      <MaintenanceAutomationStats />

      <OperationalInsightsWidget insights={operationalInsights} loading={loading} error={error} />

      <RecentWorkOrders rows={recentWorkOrders} loading={loading} error={error} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <EquipmentDue items={equipmentDueSoon} loading={loading} error={error} />
        <ExpiringWarranties items={expiringWarranties} loading={loading} error={error} />
        <RepeatRepairs items={repeatRepairs} loading={loading} error={error} />
      </div>
    </div>
  )
}
