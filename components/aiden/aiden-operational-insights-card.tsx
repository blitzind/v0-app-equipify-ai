"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bot, ChevronDown, ChevronUp, Lightbulb, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  OPERATIONAL_SCALE_ONLY_MESSAGE_AFTER_LINK,
  OPERATIONAL_SCALE_ONLY_MESSAGE_BEFORE_LINK,
} from "@/lib/aiden/operational-messages"
import type {
  AidenOperationalRecommendationsAnswer,
  OperationalModuleContext,
} from "@/lib/aiden/operational-recommendations-schema"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type EligibilityResponse = {
  ok?: boolean
  productivityEnabled?: boolean
  operationalCopilotEnabled?: boolean
  operationalGrowthHint?: boolean
}

const severityStyle: Record<string, string> = {
  low: "border-border bg-muted/30 text-foreground",
  medium: "border-amber-500/35 bg-amber-500/5",
  high: "border-destructive/40 bg-destructive/5",
}

export function AidenOperationalInsightsCard({
  organizationId,
  moduleContext,
  className,
}: {
  organizationId: string
  moduleContext: OperationalModuleContext
  className?: string
}) {
  const { toast } = useToast()
  const [eligibilityReady, setEligibilityReady] = useState(false)
  const [copilotEnabled, setCopilotEnabled] = useState(false)
  const [growthHint, setGrowthHint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<AidenOperationalRecommendationsAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/aiden/productivity/eligibility`,
          { method: "GET" },
        )
        const data = (await res.json().catch(() => ({}))) as EligibilityResponse
        if (!cancelled && res.ok && data.ok) {
          setCopilotEnabled(Boolean(data.operationalCopilotEnabled))
          setGrowthHint(Boolean(data.operationalGrowthHint))
        }
      } finally {
        if (!cancelled) setEligibilityReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const loadRecommendations = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/aiden/operational-recommendations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleContext }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        answer?: AidenOperationalRecommendationsAnswer
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.answer) {
        throw new Error(data.message ?? data.error ?? "Could not load recommendations.")
      }
      setAnswer(data.answer)
      setExpanded(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed."
      setError(msg)
      toast({ variant: "destructive", title: "Insights unavailable", description: msg })
    } finally {
      setBusy(false)
    }
  }, [organizationId, moduleContext, toast])

  if (!eligibilityReady) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground", className)}>
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
          AIden insights…
        </span>
      </div>
    )
  }

  if (!copilotEnabled && !growthHint) {
    return null
  }

  if (growthHint && !copilotEnabled) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-xs text-muted-foreground leading-relaxed",
          className,
        )}
      >
        {OPERATIONAL_SCALE_ONLY_MESSAGE_BEFORE_LINK}
        <Link
          href="/settings/billing"
          className="text-muted-foreground underline decoration-muted-foreground/50 underline-offset-[3px] hover:text-foreground hover:decoration-foreground/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
        >
          Scale
        </Link>
        {OPERATIONAL_SCALE_ONLY_MESSAGE_AFTER_LINK}
      </div>
    )
  }

  return (
    <Card className={cn("border-border shadow-sm overflow-hidden", className)}>
      <CardHeader className="py-3 px-4 border-b border-border bg-muted/15">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-300">
              <Bot size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Operational insights</CardTitle>
              <CardDescription className="text-[11px] leading-snug">
                Read-only recommendations — nothing is changed automatically.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 shrink-0 text-xs"
            disabled={busy}
            onClick={() => void loadRecommendations()}
          >
            {busy ?
              <Loader2 className="size-3.5 animate-spin" />
            : <Sparkles className="size-3.5" />}
            {answer ? "Refresh insights" : "Get insights"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-3 space-y-3">
        {!answer && !error ?
          <p className="text-xs text-muted-foreground">
            Summarize scheduling risk, aging jobs, and follow-up gaps from live workspace signals (counts & dates only).
          </p>
        : null}
        {error ?
          <p className="text-xs text-destructive">{error}</p>
        : null}

        {answer?.overview ?
          <p className="text-sm text-foreground/95">{answer.overview}</p>
        : null}

        {answer?.recommendations?.length ?
          <div className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              <span className="inline-flex items-center gap-1.5">
                <Lightbulb className="size-3.5 opacity-70" aria-hidden />
                {answer.recommendations.length} recommendation{answer.recommendations.length === 1 ? "" : "s"}
              </span>
              {expanded ?
                <ChevronUp className="size-4 opacity-60" />
              : <ChevronDown className="size-4 opacity-60" />}
            </button>
            {expanded ?
              <ul className="space-y-2">
                {answer.recommendations.map((rec, idx) => (
                  <li
                    key={`${rec.title}-${idx}`}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      severityStyle[rec.severity] ?? severityStyle.low,
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{rec.title}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{rec.severity}</span>
                      <span className="text-[10px] text-muted-foreground">· {rec.category}</span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/90 leading-relaxed">{rec.explanation}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">Next step: </span>
                      {rec.suggestedNextStep}
                    </p>
                    {rec.relatedRecordIds?.length ?
                      <p className="mt-1 text-[10px] font-mono text-muted-foreground break-all">
                        Related ids: {rec.relatedRecordIds.join(", ")}
                      </p>
                    : null}
                  </li>
                ))}
              </ul>
            : null}
          </div>
        : null}
      </CardContent>
    </Card>
  )
}
