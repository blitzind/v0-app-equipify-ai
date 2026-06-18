"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Target } from "lucide-react"
import {
  GROWTH_OPPORTUNITIES_WORKSPACE_NAV_QA_MARKER,
  GROWTH_OPPORTUNITIES_WORKSPACE_TABS,
  isGrowthOpportunitiesTabRoute,
  resolveGrowthOpportunitiesActiveTabId,
} from "@/lib/growth/navigation/growth-opportunities-workspace-navigation"
import { cnDrawerTabButton } from "@/components/ui/tabs-chrome"
import { GROWTH_WORKSPACE_PAGE_STACK } from "@/lib/workspace/workspace-shell-tokens"

type GrowthOpportunitiesShellProps = {
  children: ReactNode
}

export function GrowthOpportunitiesShell({ children }: GrowthOpportunitiesShellProps) {
  const pathname = usePathname()

  if (!isGrowthOpportunitiesTabRoute(pathname)) {
    return <>{children}</>
  }

  const activeTabId = resolveGrowthOpportunitiesActiveTabId(pathname)
  const activeTab = GROWTH_OPPORTUNITIES_WORKSPACE_TABS.find((tab) => tab.id === activeTabId)

  return (
    <div
      className={GROWTH_WORKSPACE_PAGE_STACK}
      data-qa-marker={GROWTH_OPPORTUNITIES_WORKSPACE_NAV_QA_MARKER}
    >
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <Target size={17} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Opportunities</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Opportunity operating workspace — overview, pipeline management, and readiness intelligence without
              autonomous deal progression.
            </p>
          </div>
        </div>
      </section>

      <nav
        aria-label="Opportunities sections"
        className="flex flex-wrap gap-2 border-b border-border pb-3"
      >
        {GROWTH_OPPORTUNITIES_WORKSPACE_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cnDrawerTabButton(activeTabId === tab.id)}
            aria-current={activeTabId === tab.id ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab ? (
        <p className="text-sm text-muted-foreground" data-opportunities-tab-description={activeTab.id}>
          {activeTab.description}
        </p>
      ) : null}

      <div className="min-w-0">{children}</div>
    </div>
  )
}
