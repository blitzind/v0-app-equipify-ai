"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthHomeBusinessIntelligencePanel } from "@/components/growth/workspace/executive-briefing/growth-home-business-intelligence-panel"
import {
  GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE,
  GROWTH_BUSINESS_INTELLIGENCE_READ_ONLY_BANNER,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_CTA_LABEL,
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_DECISION_API_PATH,
  GROWTH_BUSINESS_INTELLIGENCE_SECTION_SUBTITLE,
  GROWTH_BUSINESS_INTELLIGENCE_SECTION_TITLE,
  GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
  growthBusinessIntelligenceReportHref,
  type BusinessIntelligenceReviewDecisionType,
  type BusinessIntelligenceReviewFieldKey,
  type GrowthBusinessIntelligenceApplyToProfileApiResponse,
  type GrowthBusinessIntelligenceReportApiResponse,
  type GrowthBusinessIntelligenceResearchApiResponse,
  type GrowthBusinessIntelligenceReviewDecisionApiResponse,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { cn } from "@/lib/utils"

type ViewState = "loading" | "empty" | "researching" | "ready" | "error"

export function GrowthHomeBusinessIntelligenceSection({ embedded = false }: { embedded?: boolean }) {
  const [view, setView] = useState<ViewState>("loading")
  const [response, setResponse] = useState<GrowthBusinessIntelligenceReportApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [researchStepIndex, setResearchStepIndex] = useState(0)
  const [recentlyResearched, setRecentlyResearched] = useState(false)
  const [reviewBusyFieldKey, setReviewBusyFieldKey] = useState<string | null>(null)
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)
  const researchStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopResearchStepTimer = useCallback(() => {
    if (researchStepTimerRef.current) {
      clearInterval(researchStepTimerRef.current)
      researchStepTimerRef.current = null
    }
  }, [])

  const startResearchStepTimer = useCallback(() => {
    stopResearchStepTimer()
    setResearchStepIndex(0)
    researchStepTimerRef.current = setInterval(() => {
      setResearchStepIndex((current) => (current + 1) % GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS.length)
    }, 1400)
  }, [stopResearchStepTimer])

  useEffect(() => () => stopResearchStepTimer(), [stopResearchStepTimer])

  const applyReportResponse = useCallback((payload: GrowthBusinessIntelligenceReportApiResponse) => {
    setResponse(payload)
    if (payload.empty_state || !payload.payload?.report) {
      setView("empty")
      return
    }
    setView("ready")
  }, [])

  const loadReport = useCallback(async () => {
    setError(null)
    setView("loading")

    const res = await fetch(growthBusinessIntelligenceReportHref(true), { cache: "no-store" })
    const payload = (await res.json()) as GrowthBusinessIntelligenceReportApiResponse

    if (!res.ok || !payload.ok) {
      throw new Error(payload.message ?? "Could not load Business Intelligence report.")
    }

    applyReportResponse(payload)
  }, [applyReportResponse])

  useEffect(() => {
    void loadReport().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load Business Intelligence report.")
      setView("error")
    })
  }, [loadReport])

  const runResearch = useCallback(
    async (forceRefresh = false) => {
      setError(null)
      setRecentlyResearched(false)
      setView("researching")
      startResearchStepTimer()

      try {
        const res = await fetch(GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceRefresh }),
          cache: "no-store",
        })
        const payload = (await res.json()) as GrowthBusinessIntelligenceResearchApiResponse

        if (!res.ok || !payload.ok || !payload.payload?.report) {
          throw new Error(payload.message ?? "Could not research your company.")
        }

        setRecentlyResearched(Boolean(payload.recently_researched || payload.cached))
        applyReportResponse({
          ok: true,
          qa_marker: GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
          empty_state: false,
          payload: payload.payload,
        })
      } catch (researchError) {
        setError(
          researchError instanceof Error ? researchError.message : "Could not research your company.",
        )
        setView(response?.payload?.report ? "ready" : "empty")
      } finally {
        stopResearchStepTimer()
      }
    },
    [applyReportResponse, response?.payload?.report, startResearchStepTimer, stopResearchStepTimer],
  )

  const saveReviewDecision = useCallback(
    async (input: {
      fieldKey: BusinessIntelligenceReviewFieldKey
      decision: BusinessIntelligenceReviewDecisionType
      approvedValue?: string | string[] | null
    }) => {
      setReviewBusyFieldKey(input.fieldKey)
      setError(null)
      try {
        const res = await fetch(GROWTH_BUSINESS_INTELLIGENCE_REVIEW_DECISION_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          cache: "no-store",
        })
        const payload = (await res.json()) as GrowthBusinessIntelligenceReviewDecisionApiResponse
        if (!res.ok || !payload.ok || !payload.decision) {
          throw new Error(payload.message ?? "Could not save review decision.")
        }

        setResponse((current) => {
          if (!current?.payload) return current
          return {
            ...current,
            payload: {
              ...current.payload,
              review_decisions: {
                ...(current.payload.review_decisions ?? {}),
                [payload.decision!.field_key]: payload.decision!,
              },
              review_progress: payload.review_progress ?? current.payload.review_progress,
            },
          }
        })
      } finally {
        setReviewBusyFieldKey(null)
      }
    },
    [],
  )

  const applyToBusinessProfile = useCallback(async () => {
    setApplyBusy(true)
    setApplyMessage(null)
    setError(null)
    try {
      const res = await fetch(GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      })
      const payload = (await res.json()) as GrowthBusinessIntelligenceApplyToProfileApiResponse
      if (!res.ok || !payload.ok) {
        throw new Error(payload.message ?? "Could not apply review decisions to Business Profile.")
      }
      setApplyMessage(payload.message ?? "Business Profile draft updated.")
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Could not apply review decisions.")
    } finally {
      setApplyBusy(false)
    }
  }, [])

  const researchStepLabel = GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS[researchStepIndex]

  const content = (
    <div
      data-qa-section="home-business-intelligence"
      data-qa-marker={GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER}
      className={cn("space-y-4", embedded ? "" : "rounded-2xl border border-border/70 bg-card p-5 sm:p-6")}
    >
      {!embedded ? (
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/30">
            <Brain className="size-4 text-foreground/80" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight">{GROWTH_BUSINESS_INTELLIGENCE_SECTION_TITLE}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{GROWTH_BUSINESS_INTELLIGENCE_SECTION_SUBTITLE}</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium">{GROWTH_BUSINESS_INTELLIGENCE_SECTION_TITLE}</p>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_BUSINESS_INTELLIGENCE_SECTION_SUBTITLE}</p>
        </div>
      )}

      {view === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading Business Intelligence…
        </div>
      ) : null}

      {view === "researching" ? (
        <div
          className="space-y-3 rounded-xl border border-border/70 bg-muted/15 px-4 py-4"
          data-qa-state="researching"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Researching your company…
          </div>
          <p className="text-sm text-muted-foreground">{researchStepLabel}</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_STEPS.map((step, index) => (
              <li
                key={step}
                className={cn(index === researchStepIndex ? "font-medium text-foreground" : undefined)}
              >
                {step}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view === "error" ? (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error ?? "Could not load Business Intelligence report."}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadReport()}>
            Retry
          </Button>
        </div>
      ) : null}

      {view === "empty" ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-4">
          <p className="text-sm">{GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE}</p>
          <p className="text-xs text-muted-foreground">{GROWTH_BUSINESS_INTELLIGENCE_READ_ONLY_BANNER}</p>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={view === "researching"}
              onClick={() => void runResearch(false)}
              data-qa-action="research-my-company"
            >
              {GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_CTA_LABEL}
            </Button>
            {error ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void runResearch(false)}>
                Retry research
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {view === "ready" && response?.payload ? (
        <>
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <GrowthHomeBusinessIntelligencePanel
            payload={response.payload}
            recentlyResearched={recentlyResearched}
            showReviewPrompt={recentlyResearched || view === "ready"}
            reviewBusyFieldKey={reviewBusyFieldKey}
            applyBusy={applyBusy}
            applyMessage={applyMessage}
            onReviewDecision={saveReviewDecision}
            onApplyToProfile={applyToBusinessProfile}
          />
        </>
      ) : null}
    </div>
  )

  return content
}
