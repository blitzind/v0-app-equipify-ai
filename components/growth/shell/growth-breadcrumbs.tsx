"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Loader2 } from "lucide-react"
import { useGrowthBreadcrumbState } from "@/components/growth/shell/growth-breadcrumb-context"
import { resolveGrowthBreadcrumbs } from "@/lib/growth/navigation/growth-route-registry"
import { WORKSPACE_SHELL_HORIZONTAL_PADDING } from "@/lib/workspace/workspace-shell-tokens"
import { cn } from "@/lib/utils"

export const GROWTH_BREADCRUMBS_QA_MARKER = "growth-workspace-breadcrumbs-v1" as const

type GrowthBreadcrumbsProps = {
  className?: string
}

export function GrowthBreadcrumbs({ className }: GrowthBreadcrumbsProps) {
  const pathname = usePathname()
  const { detailLabel, detailLoading } = useGrowthBreadcrumbState()
  const crumbs = resolveGrowthBreadcrumbs(pathname, { detailLabel, detailLoading })

  if (crumbs.length <= 1 && pathname === "/growth") return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "border-b border-border/60 bg-muted/20 py-2",
        WORKSPACE_SHELL_HORIZONTAL_PADDING,
        className,
      )}
      data-qa-marker={GROWTH_BREADCRUMBS_QA_MARKER}
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden /> : null}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn("inline-flex items-center gap-1", isLast && "font-medium text-foreground")}>
                  {crumb.loading ? <Loader2 className="size-3 animate-spin opacity-70" aria-hidden /> : null}
                  {crumb.loading && !crumb.label ? "Loading…" : crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
