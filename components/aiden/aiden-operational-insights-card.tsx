"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bot, ChevronDown, ChevronUp, Layers, Lightbulb, Loader2, Sparkles } from "lucide-react"
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
import { sendOnboardingProductEvent } from "@/hooks/use-onboarding-product-event"
import type { IndustryOperationalBrief } from "@/lib/aiden/industry-operational-public-types"
import {
  OPERATIONAL_MODULE_PATHS,
  presentationFromInsight,
  type OperationalInsightPresentation,
} from "@/lib/aiden/operational-insight-schema"
import { WORKSPACE_INDUSTRY_DEFINITIONS } from "@/lib/workspace-industry-registry"

type EligibilityResponse = {
  ok?: boolean
  productivityEnabled?: boolean
  operationalCopilotEnabled?: boolean
  operationalGrowthHint?: boolean
}

const presentationStyle: Record<OperationalInsightPresentation, string> = {
  critical: "border-red-600/55 bg-red-600/8 ring-1 ring-red-600/15",
  warning: "border-amber-600/45 bg-amber-500/6 ring-1 ring-amber-600/12",
  informational: "border-border bg-muted/25 text-foreground",
  healthy: "border-emerald-600/30 bg-emerald-600/5 ring-1 ring-emerald-600/10",
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
  const [industryBrief, setIndustryBrief] = useState<IndustryOperationalBrief | null>(null)
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

  useEffect(() => {
    if (!eligibilityReady || !copilotEnabled || !organizationId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/aiden/operational-recommendations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleContext, skipAi: true }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          industryOperational?: IndustryOperationalBrief | null
        }
        if (!cancelled && res.ok && data.ok && data.industryOperational) {
          setIndustryBrief(data.industryOperational)
        }
      } catch {
        /* non-fatal */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eligibilityReady, copilotEnabled, organizationId, moduleContext])

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
        industryOperational?: IndustryOperationalBrief | null
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.answer) {
        throw new Error(data.message ?? data.error ?? "Could not load recommendations.")
      }
      setAnswer(data.answer)
      if (data.industryOperational) setIndustryBrief(data.industryOperational)
      setExpanded(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed."
      setError(msg)
      toast({ variant: "destructive", title: "Insights unavailable", description: msg })
    } finally {
      setBusy(false)
    }
  }, [organizationId, moduleContext, toast])

  useEffect(() => {
    if (!answer?.recommendations?.length || typeof window === "undefined") return
    const k = `equipify_onb_ai_rec_viewed_${organizationId}_${moduleContext}`
    if (sessionStorage.getItem(k)) return
    sessionStorage.setItem(k, "1")
    sendOnboardingProductEvent(organizationId, "onboarding_ai_recommendation_viewed", moduleContext)
  }, [answer, organizationId, moduleContext])

  const industryLabel = industryBrief ? WORKSPACE_INDUSTRY_DEFINITIONS[industryBrief.industryKey]?.label : null
  const showIndustryBlock =
    industryBrief &&
    (industryBrief.dashboardSummaryLines.length > 0 ||
      industryBrief.maintenanceSummaryLines.length > 0 ||
      industryBrief.dashboardOperationalSummaries.length > 0 ||
      industryBrief.maintenanceOperationalSummaries.length > 0 ||
      industryBrief.deterministicInsights.length > 0)

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
                {industryLabel ?
                  <span className="block text-muted-foreground/90 mt-1">Industry lens: {industryLabel}</span>
                : null}
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
        {showIndustryBlock ?
          <section className="space-y-2.5 rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5" aria-label="Industry workspace signals">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Layers className="size-3.5 opacity-80 shrink-0" aria-hidden />
                Workspace signals
              </span>
              {industryBrief!.signalsPresentationHealthy ?
                <span className="rounded-full border border-emerald-600/25 bg-emerald-600/8 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-800 dark:text-emerald-200">
                  Healthy signals
                </span>
              : null}
            </div>
            {(() => {
              const ib = industryBrief!
              const first =
                moduleContext === "maintenance_plans" ? ib.maintenanceSummaryLines : ib.dashboardSummaryLines
              const second =
                moduleContext === "maintenance_plans" ? ib.dashboardSummaryLines : ib.maintenanceSummaryLines
              return (
                <>
                  {first.length > 0 ?
                    <ul className="list-disc pl-4 space-y-1 text-xs text-foreground/90">
                      {first.map((line) => (
                        <li key={line} className="leading-snug">
                          {line}
                        </li>
                      ))}
                    </ul>
                  : null}
                  {second.length > 0 ?
                    <ul className="list-disc pl-4 space-y-1 text-xs text-foreground/90">
                      {second.map((line) => (
                        <li key={`sec-${line}`} className="leading-snug">
                          {line}
                        </li>
                      ))}
                    </ul>
                  : null}
                </>
              )
            })()}
            {industryBrief!.deterministicInsights.length > 0 ?
              <ul className="space-y-2">
                {industryBrief!.deterministicInsights.map((sig) => {
                  const tier = presentationFromInsight(sig)
                  return (
                    <li
                      key={sig.id}
                      className={cn("rounded-md border px-2.5 py-2 text-xs", presentationStyle[tier])}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 gap-y-0.5">
                        <span className="font-medium text-foreground">{sig.title}</span>
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                          {sig.severity} · {sig.confidence} · {sig.category.replace(/-/g, " ")}
                        </span>
                        <span className="text-[9px] text-muted-foreground">Urgency: {sig.urgency}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-foreground/90">{sig.detail}</p>
                      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                        <span className="font-medium text-foreground/80">Why: </span>
                        {sig.triggerRationale}
                      </p>
                      {sig.thresholdsUsed.length > 0 ?
                        <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                          {sig.thresholdsUsed.map((t) => (
                            <li key={t}>Threshold: {t}</li>
                          ))}
                        </ul>
                      : null}
                      <ul className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                        {sig.evidence.map((ev) => (
                          <li key={ev}>· {ev}</li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[10px] leading-snug text-foreground/90">
                        <span className="font-medium text-foreground/85">Next: </span>
                        {sig.suggestedNextStep}
                        <span className="text-muted-foreground"> · </span>
                        <Link
                          href={OPERATIONAL_MODULE_PATHS[sig.relevantModule]}
                          className="text-foreground/80 underline decoration-muted-foreground/60 underline-offset-2 hover:text-foreground"
                        >
                          Open {sig.relevantModule.replace(/_/g, " ")}
                        </Link>
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground italic">{sig.suggestedWorkflow}</p>
                    </li>
                  )
                })}
              </ul>
            : null}
            <p className="text-[10px] text-muted-foreground leading-snug">
              Signals use work order types, dates, equipment status, and bounded title keyword matches — not predictions
              or sensor claims.
            </p>
          </section>
        : null}

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
                {answer.recommendations.map((rec, idx) => {
                  const recTier: OperationalInsightPresentation =
                    rec.severity === "high" ? "warning" : "informational"
                  return (
                    <li
                      key={`${rec.title}-${idx}`}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        presentationStyle[recTier],
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
                  )
                })}
              </ul>
            : null}
          </div>
        : null}
      </CardContent>
    </Card>
  )
}
