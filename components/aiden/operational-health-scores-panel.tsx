"use client"

import { useEffect, useState } from "react"
import { Activity, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { OperationalHealthScoresReport } from "@/lib/aiden/operational-health-score-types"
import type { OperationalModuleContext } from "@/lib/aiden/operational-recommendations-schema"

const bandBadgeClass: Record<OperationalHealthScoresReport["overallBand"], string> = {
  at_risk: "border-red-600/40 bg-red-600/10 text-red-900 dark:text-red-100",
  needs_attention: "border-amber-600/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  stable: "border-sky-600/35 bg-sky-500/8 text-sky-950 dark:text-sky-100",
  strong: "border-emerald-600/35 bg-emerald-600/8 text-emerald-950 dark:text-emerald-100",
  optimized: "border-emerald-600/45 bg-emerald-600/12 text-emerald-950 dark:text-emerald-100",
}

export function OperationalHealthScoresPanel({
  organizationId,
  moduleContext = "dashboard",
  className,
}: {
  organizationId: string
  moduleContext?: OperationalModuleContext
  className?: string
}) {
  const [data, setData] = useState<OperationalHealthScoresReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/aiden/operational-recommendations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleContext, skipAi: true }),
          },
        )
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          operationalHealthScores?: OperationalHealthScoresReport | null
          message?: string
        }
        if (!res.ok || !body.ok) {
          if (!cancelled) {
            setData(null)
          }
          return
        }
        if (!cancelled) setData(body.operationalHealthScores ?? null)
      } catch {
        if (!cancelled) {
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, moduleContext])

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-muted/15 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2",
          className,
        )}
      >
        <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
        Loading operational health index…
      </div>
    )
  }

  if (!data) return null

  return (
    <Card className={cn("border-border shadow-sm overflow-hidden", className)}>
      <CardHeader className="py-3 px-4 border-b border-border bg-muted/10">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/12 text-sky-800 ring-1 ring-sky-500/20 dark:text-sky-200">
              <Activity size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">AI Operations health index</CardTitle>
              <CardDescription className="text-[11px] leading-snug mt-0.5">
                Deterministic 0–100 scores from live work orders, PM plans, and equipment samples — not a diagnosis or
                forecast. Weights follow your workspace industry when set.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={cn("shrink-0 text-[10px] font-semibold", bandBadgeClass[data.overallBand])}>
            {data.overallLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Overall</p>
            <p className="text-3xl font-semibold tabular-nums text-foreground leading-none">{data.overallScore}</p>
          </div>
          <p className="text-xs text-foreground/90 max-w-xl flex-1 min-w-[12rem]">{data.overallSummary}</p>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug border-l-2 border-muted pl-2">{data.methodologyNote}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 -ml-2 text-xs text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ?
            <>
              <ChevronUp className="size-3.5 mr-1" />
              Hide category detail
            </>
          : <>
              <ChevronDown className="size-3.5 mr-1" />
              Show categories & factors
            </>}
        </Button>
        {expanded ?
          <ul className="space-y-3 pt-1">
            {data.categories.map((c) => (
              <li key={c.id} className="rounded-lg border border-border/80 bg-muted/5 px-3 py-2 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{c.title}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {c.scoreIncludedInOverall ? `${c.score}/100` : "— excluded"}
                  </span>
                </div>
                {c.scoreIncludedInOverall ?
                  <Progress value={c.score} className="h-1.5" />
                : null}
                <p className="text-[10px] text-muted-foreground leading-snug">{c.weightedLogicNote}</p>
                <ul className="text-[10px] space-y-0.5 text-muted-foreground">
                  {c.contributingFactors.map((f) => (
                    <li key={`${c.id}-${f.label}`}>
                      <span
                        className={cn(
                          "font-medium",
                          f.impact === "negative" ? "text-amber-900 dark:text-amber-200"
                          : f.impact === "positive" ? "text-emerald-900 dark:text-emerald-200"
                          : "text-foreground/80",
                        )}
                      >
                        {f.label}
                      </span>
                      : {String(f.value)} — {f.detail}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-foreground/90">
                  <span className="font-medium">Recommendation: </span>
                  {c.recommendation}
                </p>
                {c.operationalGaps.length > 0 ?
                  <ul className="text-[10px] list-disc pl-4 text-muted-foreground">
                    {c.operationalGaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                : null}
              </li>
            ))}
          </ul>
        : null}
        {data.limitations.length > 0 ?
          <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/60">
            <p className="font-medium text-foreground/70">Limitations</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {data.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        : null}
      </CardContent>
    </Card>
  )
}
