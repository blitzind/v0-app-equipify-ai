import {
  CalendarClock,
  AlertCircle,
  ClipboardList,
  DollarSign,
  ShieldAlert,
  Repeat2,
} from "lucide-react"
import { mockStats } from "@/lib/mock-data"
import { StatCard } from "@/components/dashboard/stat-card"
import { RecentWorkOrders } from "@/components/dashboard/recent-work-orders"
import { EquipmentDue } from "@/components/dashboard/equipment-due"
import { RepeatRepairs } from "@/components/dashboard/repeat-repairs"
import { ExpiringWarranties } from "@/components/dashboard/expiring-warranties"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { WorkOrderStatus } from "@/components/dashboard/work-order-status"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Equipment Due This Month"
          value={mockStats.equipmentDueThisMonth}
          subtitle="Scheduled for service"
          icon={CalendarClock}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          trend={{ value: "+5 from last month", positive: false }}
        />
        <StatCard
          title="Overdue Service"
          value={mockStats.overdueService}
          subtitle="Immediate attention needed"
          icon={AlertCircle}
          iconColor="text-destructive"
          iconBg="bg-destructive/10"
          urgent
        />
        <StatCard
          title="Open Work Orders"
          value={mockStats.openWorkOrders}
          subtitle="Across all technicians"
          icon={ClipboardList}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          trend={{ value: "+11 this week", positive: false }}
        />
        <StatCard
          title="Monthly Revenue"
          value={"$184K"}
          subtitle="April 2026"
          icon={DollarSign}
          iconColor="text-[oklch(0.42_0.17_145)]"
          iconBg="bg-[oklch(0.62_0.17_145)]/10"
          trend={{ value: "+7.1% vs March", positive: true }}
        />
        <StatCard
          title="Expiring Warranties"
          value={mockStats.expiringWarranties}
          subtitle="Within 30 days"
          icon={ShieldAlert}
          iconColor="text-[oklch(0.50_0.12_70)]"
          iconBg="bg-[oklch(0.75_0.16_70)]/10"
          trend={{ value: "3 expire this week", positive: false }}
        />
        <StatCard
          title="Repeat Repair Alerts"
          value={mockStats.repeatRepairAlerts}
          subtitle="Flagged units"
          icon={Repeat2}
          iconColor="text-destructive"
          iconBg="bg-destructive/10"
          urgent
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <WorkOrderStatus />
        </div>
      </div>

      {/* Main table */}
      <RecentWorkOrders />

      {/* Bottom panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EquipmentDue />
        <ExpiringWarranties />
        <RepeatRepairs />
      </div>
    </div>
  )
}
