"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Mail } from "lucide-react"
import { GrowthFeatureLink } from "@/components/growth/runtime/growth-feature-link"
import {
  GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER,
  isGrowthInboxTabRoute,
  resolveGrowthInboxActiveTabId,
  resolveGrowthInboxWorkspaceTabs,
} from "@/lib/growth/navigation/growth-inbox-workspace-navigation"
import { useGrowthTier2ShellVisible } from "@/lib/growth/runtime/use-growth-feature-shell-mounted"
import { cnDrawerTabButton } from "@/components/ui/tabs-chrome"

type GrowthInboxShellProps = {
  children: ReactNode
}

export function GrowthInboxShell({ children }: GrowthInboxShellProps) {
  const pathname = usePathname()
  const tier2ShellVisible = useGrowthTier2ShellVisible()

  if (!isGrowthInboxTabRoute(pathname)) {
    return <>{children}</>
  }

  const activeTabId = resolveGrowthInboxActiveTabId(pathname)
  const tabs = resolveGrowthInboxWorkspaceTabs({ tier2ShellVisible })
  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 md:px-6"
      data-qa-marker={GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER}
      data-growth-tier2-shell-visible={tier2ShellVisible ? "true" : "false"}
    >
      <header className="flex min-h-[4.25rem] items-center gap-3 border-b border-border pb-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <Mail size={15} />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight tracking-tight">Inbox</h1>
          <p className="truncate text-xs text-muted-foreground">
            Unified communications workspace for email, SMS, calls, and workflow actions.
          </p>
        </div>
      </header>

      <nav aria-label="Inbox sections" className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((tab) => (
          <GrowthFeatureLink
            key={tab.id}
            href={tab.href}
            className={cnDrawerTabButton(activeTabId === tab.id)}
            aria-current={activeTabId === tab.id ? "page" : undefined}
          >
            {tab.label}
          </GrowthFeatureLink>
        ))}
      </nav>

      {activeTab && activeTabId !== "inbox" ? (
        <p className="text-xs text-muted-foreground" data-inbox-tab-description={activeTab.id}>
          {activeTab.description}
        </p>
      ) : null}

      <div className="min-w-0">{children}</div>
    </div>
  )
}
