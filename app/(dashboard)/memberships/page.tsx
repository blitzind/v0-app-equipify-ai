"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { BlitzpayMembershipsDashboard } from "@/components/blitzpay/blitzpay-memberships-dashboard"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"

export default function MembershipsPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions, status: permStatus } = useOrgPermissions()

  const canView = permStatus === "ready" && (permissions.canViewFinancialReports || permissions.canViewFinancials)

  if (!canView) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] flex gap-3">
          <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)] shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Memberships are restricted</p>
            <p className="text-muted-foreground leading-relaxed">
              You need financial reports or financials access to view recurring memberships and agreement billing signals.
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
      <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
        Recurring service agreements and membership billing are native to Equipify. Invoices generate on a deterministic cron (
        <span className="font-mono text-[10px]">POST /api/cron/blitzpay-memberships</span>
        ). Customers can review plans in the portal under{" "}
        <span className="font-medium">Memberships</span> once invited.
      </p>
      <BlitzpayMembershipsDashboard organizationId={organizationId} orgReady={orgStatus === "ready"} />
    </div>
  )
}
