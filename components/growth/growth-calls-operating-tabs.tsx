"use client"

import { Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Headphones, LayoutDashboard, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import {
  GROWTH_CALLS_PAGE_DESCRIPTION,
  GROWTH_CALLS_PAGE_TITLE,
  GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER,
  GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER,
  growthCallsOperatingHref,
  type GrowthCallsOperatingView,
  resolveGrowthCallsOperatingView,
} from "@/lib/growth/navigation/growth-workspace-consolidation"

const VIEW_TAB_DEFS: Array<{
  id: GrowthCallsOperatingView
  label: string
  icon: typeof Headphones
}> = [
  { id: "operate", label: "Operate", icon: Headphones },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "live", label: "Live monitor", icon: Radio },
]

function GrowthCallsOperatingTabsInner({ className }: { className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeView = resolveGrowthCallsOperatingView({
    pathname,
    viewParam: searchParams.get("view"),
  })
  const viewTabs = VIEW_TAB_DEFS.map((tab) => ({
    ...tab,
    href: growthCallsOperatingHref(tab.id, pathname),
  }))

  return (
    <nav className={cn("flex flex-wrap gap-2", className)} aria-label="Calls operating views">
      {viewTabs.map((tab) => {
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

function TabsFallback() {
  return <p className="text-xs text-muted-foreground">Loading call views…</p>
}

export function GrowthCallsOperatingTabs({ className }: { className?: string }) {
  return (
    <Suspense fallback={<TabsFallback />}>
      <GrowthCallsOperatingTabsInner className={className} />
    </Suspense>
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
      data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
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
