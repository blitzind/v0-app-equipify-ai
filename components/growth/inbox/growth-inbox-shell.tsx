"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER,
  GROWTH_INBOX_WORKSPACE_TABS,
  isGrowthInboxTabRoute,
  resolveGrowthInboxActiveTabId,
} from "@/lib/growth/navigation/growth-inbox-workspace-navigation"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_INBOX_DIAGNOSTICS_HREF } from "@/lib/growth/inbox/inbox-workspace-types"
import { cnDrawerTabButton } from "@/components/ui/tabs-chrome"

type GrowthInboxShellProps = {
  children: ReactNode
}

export function GrowthInboxShell({ children }: GrowthInboxShellProps) {
  const pathname = usePathname()

  if (!isGrowthInboxTabRoute(pathname)) {
    return <>{children}</>
  }

  const activeTabId = resolveGrowthInboxActiveTabId(pathname)
  const activeTab = GROWTH_INBOX_WORKSPACE_TABS.find((tab) => tab.id === activeTabId)
  const revenueQueuePath = growthFeaturePath(pathname, "leads")

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8"
      data-qa-marker={GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER}
    >
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <Mail size={17} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Canonical operator communication surface — email and SMS replies, workflow actions, and reply
                intelligence in one workspace. Human approval only; no autonomous sends.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={GROWTH_INBOX_DIAGNOSTICS_HREF}>Inbox Diagnostics</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={revenueQueuePath}>Revenue Queue</Link>
            </Button>
          </div>
        </div>
      </section>

      <nav aria-label="Inbox sections" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {GROWTH_INBOX_WORKSPACE_TABS.map((tab) => (
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
        <p className="text-sm text-muted-foreground" data-inbox-tab-description={activeTab.id}>
          {activeTab.description}
        </p>
      ) : null}

      <div className="min-w-0">{children}</div>
    </div>
  )
}
