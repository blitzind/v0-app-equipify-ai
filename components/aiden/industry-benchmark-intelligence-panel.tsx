"use client"

import { useEffect, useState } from "react"
import { BarChart3, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { IndustryBenchmarkIntelligence } from "@/lib/aiden/industry-operational-benchmark-types"

const positionBadge: Record<string, string> = {
  favorable: "border-emerald-600/35 bg-emerald-600/8 text-emerald-950 dark:text-emerald-100",
  typical: "border-border bg-muted/30 text-foreground",
  elevated: "border-amber-600/40 bg-amber-500/8 text-amber-950 dark:text-amber-100",
  unavailable: "border-border bg-muted/20 text-muted-foreground",
}

export function IndustryBenchmarkIntelligencePanel({
  organizationId,
  className,
}: {
  organizationId: string
  className?: string
}) {
  const [data, setData] = useState<IndustryBenchmarkIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/aiden/industry-benchmarks?windowDays=30`,
          { method: "GET", cache: "no-store" },
        )
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          intelligence?: IndustryBenchmarkIntelligence
          message?: string
        }
        if (!res.ok || !body.ok) {
          throw new Error(body.message ?? "Could not load industry benchmarks.")
        }
        if (!cancelled) setData(body.intelligence ?? null)
      } catch (e) {
        if (!cancelled) {
          setData(null)
          setError(e instanceof Error ? e.message : "Request failed.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-muted/15 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2",
          className,
        )}
      >
        <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
        Loading anonymized industry benchmarks…
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-border/80 bg-muted/10 px-4 py-2 text-xs text-muted-foreground", className)}>
        {error}
      </div>
    )
  }

  if (!data) return null

  const statusLabel =
    data.sampleStatus === "ready" ? "Peer sample ready"
    : data.sampleStatus === "insufficient_industry_sample" ? "Set workspace industry"
    : "Awaiting aggregate sample"

  return (
    <Card className={cn("border-border shadow-sm overflow-hidden", className)}>
      <CardHeader className="py-3 px-4 border-b border-border bg-muted/10">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/12 text-violet-800 ring-1 ring-violet-500/20 dark:text-violet-200">
              <BarChart3 size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Industry benchmark intelligence</CardTitle>
              <CardDescription className="text-[11px] leading-snug mt-0.5">
                Anonymous p25 / p50 / p75 bands by workspace vertical — aggregate-only, never customer-identifiable.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-3 space-y-2 text-xs">
        <p className="text-[10px] text-muted-foreground leading-snug border-l-2 border-muted pl-2">{data.privacyFootnote}</p>
        <p className="text-[10px] text-muted-foreground leading-snug">{data.methodologyFootnote}</p>
        {data.sampleStatus !== "ready" ?
          <p className="text-foreground/90 leading-snug">
            {data.sampleStatus === "insufficient_industry_sample" ?
              "Select a workspace industry in organization settings so peer grouping is explicit — defaults are not used for published bands."
            : `Peer distributions publish only after at least ${data.minimumOrgsRequired} anonymized workspaces contribute for your vertical (offline job).`}
          </p>
        : null}
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
              Hide metric table
            </>
          : <>
              <ChevronDown className="size-3.5 mr-1" />
              Show metric comparisons
            </>}
        </Button>
        {expanded ?
          <ul className="space-y-2 pt-1">
            {data.comparisons.map((c) => (
              <li key={c.metricKey} className="rounded-lg border border-border/80 bg-muted/5 px-2.5 py-2 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-medium text-foreground">{c.metricTitle}</span>
                  <Badge variant="outline" className={cn("text-[9px]", positionBadge[c.position] ?? positionBadge.unavailable)}>
                    {c.position}
                    {c.versusMedian !== "unknown" ? ` · vs median: ${c.versusMedian}` : ""}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{c.explainability}</p>
                <p className="text-[10px] text-foreground/90">
                  <span className="font-medium">Recommendation: </span>
                  {c.operationalRecommendation}
                </p>
              </li>
            ))}
          </ul>
        : null}
      </CardContent>
    </Card>
  )
}
