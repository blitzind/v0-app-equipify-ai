"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { BlitzpayCollectionsCopilotPanel } from "@/components/blitzpay/blitzpay-collections-copilot-panel"
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
      <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
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
        .
      </p>
      <BlitzpayExecutiveDashboard organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayCollectionsCopilotPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
      <BlitzpayFinancialCommandCenterPanel organizationId={organizationId} orgReady={orgStatus === "ready"} />
    </div>
  )
}
