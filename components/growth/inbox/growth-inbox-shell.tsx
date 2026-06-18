"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Mail } from "lucide-react"
import { GrowthFeatureLink } from "@/components/growth/runtime/growth-feature-link"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER,
  isGrowthInboxTabRoute,
  resolveGrowthInboxActiveTabId,
  resolveGrowthInboxWorkspaceTabs,
} from "@/lib/growth/navigation/growth-inbox-workspace-navigation"
import { useGrowthTier2ShellVisible } from "@/lib/growth/runtime/use-growth-feature-shell-mounted"
import { cnDrawerTabButton } from "@/components/ui/tabs-chrome"
import { GROWTH_WORKSPACE_SECTION_TAB_STACK } from "@/lib/workspace/workspace-shell-tokens"

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
      className={GROWTH_WORKSPACE_SECTION_TAB_STACK}
      data-qa-marker={GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER}
      data-growth-tier2-shell-visible={tier2ShellVisible ? "true" : "false"}
    >
      <GrowthWorkspacePageHeader
        title="Inbox"
        description="Unified communications workspace for email, SMS, calls, and workflow actions."
        icon={Mail}
        iconClassName="bg-sky-50 text-sky-700"
      />

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
