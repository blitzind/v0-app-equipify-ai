"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Headphones, LayoutDashboard, Radio } from "lucide-react"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import {
  GROWTH_CALLS_PAGE_DESCRIPTION,
  GROWTH_CALLS_PAGE_TITLE,
  GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER,
  type GrowthCallsOperatingView,
  isGrowthCallsOperatingView,
} from "@/lib/growth/navigation/growth-workspace-consolidation"

const VIEW_TABS: Array<{
  id: GrowthCallsOperatingView
  label: string
  icon: typeof Headphones
  href: string
}> = [
  { id: "operate", label: "Operate", icon: Headphones, href: "/admin/growth/calls/workspace" },
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/admin/growth/calls/workspace?view=overview",
  },
  { id: "live", label: "Live monitor", icon: Radio, href: "/admin/growth/calls/live" },
]

function resolveActiveView(pathname: string, viewParam: string | null): GrowthCallsOperatingView {
  if (pathname.startsWith("/admin/growth/calls/live")) return "live"
  if (isGrowthCallsOperatingView(viewParam)) return viewParam
  return "operate"
}

export function GrowthCallsOperatingTabs({ className }: { className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeView = resolveActiveView(pathname, searchParams.get("view"))

  return (
    <nav className={cn("flex flex-wrap gap-2", className)} aria-label="Calls operating views">
      {VIEW_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeView === tab.id
        return (
          <Button key={tab.id} type="button" size="sm" variant={isActive ? "default" : "outline"} asChild={!isActive}>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {tab.label}
              </span>
            ) : (
              <Link href={tab.href} className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {tab.label}
              </Link>
            )}
          </Button>
        )
      })}
    </nav>
  )
}

type GrowthCallsOperatingHeaderProps = {
  showDescription?: boolean
}

export function GrowthCallsOperatingHeader({ showDescription = true }: GrowthCallsOperatingHeaderProps) {
  return (
    <section
      className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70"
      data-growth-workspace-consolidation-marker={GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Headphones size={18} />
          </span>
          <div>
            <h1 className={PAGE_STANDARD_PAGE_TITLE}>{GROWTH_CALLS_PAGE_TITLE}</h1>
            {showDescription ? (
              <p className="max-w-3xl text-sm text-muted-foreground">{GROWTH_CALLS_PAGE_DESCRIPTION}</p>
            ) : null}
          </div>
        </div>
      </div>
      <GrowthCallsOperatingTabs className="mt-4 border-t border-border/60 pt-4" />
    </section>
  )
}
