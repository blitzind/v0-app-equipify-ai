"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useBlitzPayCapabilities } from "@/hooks/use-blitzpay-capabilities"
import { blitzpayFccHref } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import {
  FCC_PRIMARY_SURFACE,
  NAV_ICON_INACTIVE_CARD,
  NAV_PRIMARY_ROW_MOTION,
  NAV_ROW_INACTIVE_HOVER_CARD,
} from "@/lib/navigation-chrome"
import { BlitzpayFccSectionHost } from "./blitzpay-fcc-section-host"

export default function FinancialCommandCenterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { permissions, status } = useOrgPermissions()
  const canView = status === "ready" && (permissions.canViewFinancialReports || permissions.canViewFinancials)
  const blitzPay = useBlitzPayCapabilities()

  if (!canView) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className={cn("rounded-xl border border-border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] flex gap-3", FCC_PRIMARY_SURFACE)}>
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
    <div className="flex flex-col gap-0 md:gap-6">
      <nav
        className="md:hidden flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-border bg-card px-3 py-2.5 -mx-4 sticky top-0 z-20"
        aria-label="BlitzPay sections"
      >
        {blitzPay.visibleFccSections.map(({ slug, label, icon: Icon }) => {
          const href = blitzpayFccHref(slug)
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={slug}
              href={href}
              className={cn(
                "group flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium shrink-0 min-h-[44px]",
                NAV_PRIMARY_ROW_MOTION,
                active ? "bg-primary/10 text-primary" : NAV_ROW_INACTIVE_HOVER_CARD,
              )}
            >
              <Icon size={14} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex gap-6 lg:gap-8 items-start mt-3 md:mt-0">
        <nav className="hidden md:flex w-48 shrink-0 flex-col gap-1 sticky top-4" aria-label="BlitzPay sections">
          {blitzPay.visibleFccSections.map(({ slug, label, icon: Icon }) => {
            const href = blitzpayFccHref(slug)
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={slug}
                href={href}
                className={cn(
                  "group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm leading-snug",
                  NAV_PRIMARY_ROW_MOTION,
                  active ? "bg-primary/10 text-primary font-medium" : NAV_ROW_INACTIVE_HOVER_CARD,
                )}
              >
                <Icon size={15} className={active ? "text-primary" : NAV_ICON_INACTIVE_CARD} />
                <span className="leading-snug">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex-1 min-w-0 max-w-full overflow-x-hidden pb-20 md:pb-6">
          <BlitzpayFccSectionHost />
          {children}
        </div>
      </div>
    </div>
  )
}
