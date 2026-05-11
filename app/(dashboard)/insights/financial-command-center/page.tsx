"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { BlitzpayExecutiveDashboard } from "@/components/blitzpay/blitzpay-executive-dashboard"
import { BlitzpayFinancialCommandCenterPanel } from "@/components/blitzpay/blitzpay-financial-command-center-panel"
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
        <div className="rounded-lg border border-border bg-muted/20 p-6 flex gap-3">
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
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">BlitzPay financial command center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Owner view of receivables, payables, treasury, credits, and forecasts. Also available under{" "}
          <Link href="/settings/payments#blitzpay-financial-command-center-anchor" className="text-primary underline-offset-2 hover:underline">
            Settings → Payments
          </Link>
          . Executive health (deterministic, no AI) is anchored at{" "}
          <Link href="/settings/payments#blitzpay-executive-dashboard-anchor" className="text-primary underline-offset-2 hover:underline">
            Settings → Payments → Executive business health
          </Link>
          .
        </p>
      </div>
      <BlitzpayExecutiveDashboard organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayFinancialCommandCenterPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
    </div>
  )
}
