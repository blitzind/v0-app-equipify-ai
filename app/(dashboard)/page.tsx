"use client"

import { AlertTriangle } from "lucide-react"
import { useSupabaseDashboard } from "@/lib/dashboard/use-supabase-dashboard"
import { RecentWorkOrders } from "@/components/dashboard/recent-work-orders"
import { EquipmentDue } from "@/components/dashboard/equipment-due"
import { RepeatRepairs } from "@/components/dashboard/repeat-repairs"
import { ExpiringWarranties } from "@/components/dashboard/expiring-warranties"
import { TechnicianTodayMobileCard } from "@/components/dashboard/technician-today-mobile"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { WorkOrderStatus } from "@/components/dashboard/work-order-status"
import { OperationalInsightsWidget } from "@/components/dashboard/ai-insights-widget"
import { MaintenanceAutomationStats } from "@/components/dashboard/maintenance-automation-stats"
import { ProspectFollowUpWidget } from "@/components/dashboard/prospect-follow-up-widget"
import { AiOpsDigestCard } from "@/components/ai-ops/digest-card"
import { TechnicianHome } from "@/components/dashboard/technician-home"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { AidenOperationalInsightsCard } from "@/components/aiden/aiden-operational-insights-card"
import { FollowUpAutomationSignals } from "@/components/dashboard/follow-up-automation-signals"
import { ServiceRequestSignals } from "@/components/dashboard/service-request-signals"
import { cn } from "@/lib/utils"
import { canReadServiceRequestQueue } from "@/lib/service-requests/list-filter"
import { DashboardLaunchpad } from "@/components/first-run/dashboard-launchpad"
import { IndustryDemoStarterPanel } from "@/components/first-run/industry-demo-starter-panel"
import { OnboardingMilestoneTelemetry } from "@/components/first-run/onboarding-milestone-telemetry"
import { ExecutiveStatCards } from "@/components/dashboard/executive-stat-cards"
import { OperationalHealthScoresPanel } from "@/components/aiden/operational-health-scores-panel"
import { IndustryBenchmarkIntelligencePanel } from "@/components/aiden/industry-benchmark-intelligence-panel"
import { useFirstRun } from "@/hooks/use-first-run"

export default function DashboardPage() {
  const { organizationId: dashboardOrgId, status: dashboardOrgStatus } = useActiveOrganization()
  const { permissions, status: permStatus } = useOrgPermissions()
  const showQuotesExecutive = Boolean(permissions.canViewQuotes)
  const showServiceRequestSignals = canReadServiceRequestQueue(permissions)
  const technicianFocused =
    permissions.canUseTechnicianWorkspace &&
    permissions.canViewAssignedWorkOrdersOnly &&
    !permissions.canViewFinancials
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
  } = useSupabaseDashboard({ disabled: technicianFocused })

  const launchpadEnabled =
    dashboardOrgStatus === "ready" &&
    Boolean(dashboardOrgId) &&
    permStatus === "ready" &&
    !technicianFocused

  const firstRun = useFirstRun(dashboardOrgId ?? null, launchpadEnabled)

  if (technicianFocused) {
    return <TechnicianHome />
  }

  const recentWoEmpty = firstRun.data?.dashboardEmptyCopy?.recentWorkOrders

  return (
    <div className="flex flex-col gap-6">
      {dashboardOrgId && launchpadEnabled ?
        <OnboardingMilestoneTelemetry organizationId={dashboardOrgId} counts={firstRun.data?.counts} />
      : null}
      <TechnicianTodayMobileCard />
      <DashboardLaunchpad firstRun={firstRun} />
      <IndustryDemoStarterPanel firstRun={firstRun} />
      {dashboardOrgStatus === "ready" && dashboardOrgId ? (
        <>
          <FollowUpAutomationSignals organizationId={dashboardOrgId} />
          {showServiceRequestSignals ?
            <ServiceRequestSignals organizationId={dashboardOrgId} />
          : null}
          <AidenOperationalInsightsCard organizationId={dashboardOrgId} moduleContext="dashboard" />
        </>
      ) : null}
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

      <ExecutiveStatCards
        stats={stats}
        loading={loading}
        showQuotesExecutive={showQuotesExecutive}
        firstRun={firstRun}
      />

      {dashboardOrgStatus === "ready" && dashboardOrgId && permissions.canViewInsights ?
        <OperationalHealthScoresPanel organizationId={dashboardOrgId} moduleContext="dashboard" />
      : null}

      {dashboardOrgStatus === "ready" && dashboardOrgId && permissions.canViewInsights ?
        <IndustryBenchmarkIntelligencePanel organizationId={dashboardOrgId} />
      : null}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <AiOpsDigestCard />
        <ProspectFollowUpWidget />
      </div>

      <OperationalInsightsWidget insights={operationalInsights} loading={loading} error={error} />

      <RecentWorkOrders
        rows={recentWorkOrders}
        loading={loading}
        error={error}
        emptyMessage={recentWoEmpty}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <EquipmentDue items={equipmentDueSoon} loading={loading} error={error} />
        <ExpiringWarranties items={expiringWarranties} loading={loading} error={error} />
        <RepeatRepairs items={repeatRepairs} loading={loading} error={error} />
      </div>
    </div>
  )
}
