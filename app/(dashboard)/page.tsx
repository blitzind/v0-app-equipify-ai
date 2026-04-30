"use client"

import {
  CalendarClock,
  AlertCircle,
  ClipboardList,
  DollarSign,
  ShieldAlert,
  Repeat2,
} from "lucide-react"
import { useWorkspaceData } from "@/lib/tenant-store"
import { StatCard } from "@/components/dashboard/stat-card"
import { RecentWorkOrders } from "@/components/dashboard/recent-work-orders"
import { EquipmentDue } from "@/components/dashboard/equipment-due"
import { RepeatRepairs } from "@/components/dashboard/repeat-repairs"
import { ExpiringWarranties } from "@/components/dashboard/expiring-warranties"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { WorkOrderStatus } from "@/components/dashboard/work-order-status"
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget"

export default function DashboardPage() {
  const { stats } = useWorkspaceData()
  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 items-stretch">
        <StatCard
          title="Equipment Due This Month"
          value={stats.equipmentDueThisMonth}
          subtitle="Scheduled for service"
          icon={CalendarClock}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          trend={{ value: "+5 from last month", positive: false }}
          href="/service-schedule"
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
        />
        <StatCard
          title="Open Work Orders"
          value={stats.openWorkOrders}
          subtitle="Across all technicians"
          icon={ClipboardList}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          trend={{ value: "+11 this week", positive: false }}
          href="/work-orders"
        />
        <StatCard
          title="Monthly Revenue"
          value={stats.monthlyRevenue}
          subtitle={stats.revenueSubtitle}
          icon={DollarSign}
          iconColor="text-[oklch(0.42_0.17_145)]"
          iconBg="bg-[oklch(0.62_0.17_145)]/10"
          trend={{ value: stats.revenueTrend, positive: true }}
          href="/reports"
        />
        <StatCard
          title="Expiring Warranties"
          value={stats.expiringWarranties}
          subtitle="Within 30 days"
          icon={ShieldAlert}
          iconColor="text-[oklch(0.50_0.12_70)]"
          iconBg="bg-[oklch(0.75_0.16_70)]/10"
          trend={{ value: stats.warrantyTrend, positive: false }}
          href="/equipment"
        />
        <StatCard
          title="Repeat Repair Alerts"
          value={stats.repeatRepairAlerts}
          subtitle="Flagged units"
          icon={Repeat2}
          iconColor="text-destructive"
          iconBg="bg-destructive/10"
          urgent
          href="/insights"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 h-full">
          <RevenueChart />
        </div>
        <div className="h-full">
          <WorkOrderStatus />
        </div>
      </div>

      {/* AI Insights widget */}
      <AIInsightsWidget />

      {/* Main table */}
      <RecentWorkOrders />

      {/* Bottom panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <EquipmentDue />
        <ExpiringWarranties />
        <RepeatRepairs />
      </div>
    </div>
  )
}
