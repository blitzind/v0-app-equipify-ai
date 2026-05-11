"use client"

import Link from "next/link"
import { CheckCircle2, Circle, LayoutDashboard, X } from "lucide-react"
import { useFirstRun } from "@/hooks/use-first-run"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

/**
 * Dismissible dashboard checklist. Step completion reflects real org data (see GET first-run API).
 */
export function DashboardLaunchpad() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions, status: permStatus } = useOrgPermissions()
  const technicianFocused =
    permissions.canUseTechnicianWorkspace &&
    permissions.canViewAssignedWorkOrdersOnly &&
    !permissions.canViewFinancials

  const enabled =
    orgStatus === "ready" && Boolean(organizationId) && permStatus === "ready" && !technicianFocused

  const { data, loading, patch } = useFirstRun(organizationId, enabled)

  if (!enabled) return null

  const applicable = data?.steps.filter((s) => s.applicable) ?? []
  const doneApplicable = applicable.filter((s) => s.done).length
  const totalApplicable = applicable.length
  const progressPct = totalApplicable > 0 ? Math.min(100, Math.round((100 * doneApplicable) / totalApplicable)) : 0
  const allApplicableDone = totalApplicable > 0 && doneApplicable === totalApplicable

  const showMainCard =
    data &&
    !data.launchpadHiddenForOrg &&
    totalApplicable > 0 &&
    (data.hasSampleWorkspace || !allApplicableDone)

  const showRestoreLink =
    Boolean(data?.launchpadHiddenForOrg) &&
    Boolean(data && (data.hasSampleWorkspace || !allApplicableDone)) &&
    totalApplicable > 0

  if (!data) {
    if (!loading) return null
    return (
      <div
        className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground print:hidden"
        aria-hidden
      >
        Loading getting started…
      </div>
    )
  }

  if (totalApplicable === 0) return null

  return (
    <div className="print:hidden flex flex-col gap-2">
      {showMainCard ? (
        <section
          className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
          aria-labelledby="launchpad-heading"
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-start gap-2 min-w-0">
              <LayoutDashboard className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <h2 id="launchpad-heading" className="text-sm font-semibold text-foreground">
                  Getting started
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {data.industryHint}{" "}
                  <span className="text-foreground/80">
                    Example jobs and invoices are for practice — add your own anytime.
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Workspace profile:{" "}
                  <span className="text-foreground font-medium">{data.industryLabel}</span>
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 text-muted-foreground"
              aria-label="Hide getting started checklist"
              onClick={() => void patch("hide_launchpad")}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Progress{" "}
                <span className="text-foreground font-medium">
                  {doneApplicable}/{totalApplicable}
                </span>{" "}
                for your role
              </span>
              {allApplicableDone ?
                <span className="text-emerald-700 font-medium">Checklist complete</span>
              : null}
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>

          <ul className="divide-y divide-border border-t border-border">
            {applicable.map((step) => (
              <li key={step.id} className="px-4 py-2.5 flex gap-3 items-start">
                <span className="shrink-0 mt-0.5" aria-hidden>
                  {step.done ?
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  : <Circle className="w-4 h-4 text-muted-foreground/60" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={step.href}
                    className={cn(
                      "text-sm font-medium hover:underline",
                      step.done ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {step.label}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{step.description}</p>
                </div>
              </li>
            ))}
          </ul>

          {data.resourceLinks.length > 0 ? (
            <div className="px-4 py-3 border-t border-border bg-muted/15">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Explore
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {data.resourceLinks.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showRestoreLink ?
        <p className="text-center text-xs text-muted-foreground">
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => void patch("show_launchpad")}
          >
            Show getting started checklist
          </button>
        </p>
      : null}
    </div>
  )
}
