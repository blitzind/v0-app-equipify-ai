"use client"

import Link from "next/link"
import { Activity, FileText, GitBranch, LayoutDashboard } from "lucide-react"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-registry"

const QUICK_LINKS = [
  {
    title: "Share Pages",
    description: "Personalized share pages, templates, and passive delivery analytics.",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages`,
    icon: FileText,
  },
  {
    title: "Automation Flows",
    description: "Visual automation builder with validation, simulation, and runtime panels.",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/automation`,
    icon: GitBranch,
  },
  {
    title: "Engagement",
    description: "Share page, media, CTA, and booking engagement rollups.",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/engagement`,
    icon: Activity,
  },
] as const

export default function GrowthWorkspaceDashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Growth Engine"
        description="Dedicated workspace for content, automation, and engagement — separate from Equipify Core operations."
        icon={LayoutDashboard}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <section className="grid gap-4 md:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                  <Icon size={16} />
                </span>
                <h2 className="text-sm font-semibold">{link.title}</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{link.description}</p>
            </Link>
          )
        })}
      </section>

      <section className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Additional workspace sections (Leads, Campaigns, Inbox, Calls, Settings) remain available through the sidebar
        and continue to use existing admin Growth routes until migrated in a later phase.
      </section>
    </div>
  )
}
