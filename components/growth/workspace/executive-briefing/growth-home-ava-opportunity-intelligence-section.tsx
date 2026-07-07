"use client"

import { useCallback, useMemo, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { GrowthHomeDailyWorkQueueItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER,
  GROWTH_HOME_AVA_ANALYZE_LEAD_LABEL,
  GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL,
  GROWTH_HOME_RECENT_IMPORTS_SECTION_LABEL,
  GROWTH_HOME_AVA_SHOW_INTELLIGENCE_LABEL,
  GROWTH_HOME_DATAMOON_RECENT_IMPORTS_API_PATH,
  type GrowthHomeDatamoonRecentImportsApiResponse,
  type GrowthHomeOpportunityIntelligenceApiResponse,
  growthHomeOpportunityIntelligenceHref,
} from "@/lib/growth/opportunity-intelligence/growth-home-opportunity-intelligence-api-contract"
import {
  GROWTH_HOME_OPPORTUNITY_BRIEF_SUBTITLE,
  GROWTH_HOME_OPPORTUNITY_BRIEF_TITLE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
import { GrowthHomeOpportunityIntelligencePanel } from "@/components/growth/workspace/executive-briefing/growth-home-opportunity-intelligence-panel"
import { GrowthHomeAvaSafeExecutionPanel } from "@/components/growth/workspace/executive-briefing/growth-home-ava-safe-execution-panel"
import { cn } from "@/lib/utils"

type Props = {
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
}

type PanelMode = "analyze" | "datamoon" | "show"

export function GrowthHomeAvaOpportunityIntelligenceSection({
  dailyWorkQueue,
  embedded = false,
}: Props & { embedded?: boolean }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PanelMode>("show")
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<GrowthHomeOpportunityIntelligenceApiResponse | null>(null)
  const [datamoonLeads, setDatamoonLeads] = useState<
    NonNullable<GrowthHomeDatamoonRecentImportsApiResponse["leads"]>
  >([])

  const suggestedLeadId = useMemo(() => dailyWorkQueue[0]?.id ?? null, [dailyWorkQueue])

  const loadDatamoonLeads = useCallback(async () => {
    const res = await fetch(`${GROWTH_HOME_DATAMOON_RECENT_IMPORTS_API_PATH}?limit=12`, { cache: "no-store" })
    const payload = (await res.json()) as GrowthHomeDatamoonRecentImportsApiResponse
    if (!res.ok || !payload.ok) {
      throw new Error(payload.message ?? "Could not load Datamoon imports.")
    }
    setDatamoonLeads(payload.leads ?? [])
    return payload.leads ?? []
  }, [])

  const loadIntelligence = useCallback(async (leadId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(growthHomeOpportunityIntelligenceHref(leadId), { cache: "no-store" })
      const payload = (await res.json()) as GrowthHomeOpportunityIntelligenceApiResponse
      if (!res.ok || !payload.ok || !payload.viewModel) {
        throw new Error(payload.message ?? "Opportunity intelligence unavailable.")
      }
      setResponse(payload)
      setSelectedLeadId(leadId)
    } catch (e) {
      setResponse(null)
      setError(e instanceof Error ? e.message : "Opportunity intelligence unavailable.")
    } finally {
      setLoading(false)
    }
  }, [])

  const openPanel = useCallback(
    async (nextMode: PanelMode) => {
      setMode(nextMode)
      setOpen(true)
      setError(null)
      setResponse(null)

      if (nextMode === "datamoon") {
        setLoading(true)
        try {
          const leads = await loadDatamoonLeads()
          if (leads[0]?.leadId) {
            await loadIntelligence(leads[0].leadId)
          } else {
            setSelectedLeadId(null)
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load Datamoon imports.")
        } finally {
          setLoading(false)
        }
        return
      }

      const leadId = suggestedLeadId
      if (!leadId) {
        setLoading(true)
        try {
          const leads = await loadDatamoonLeads()
          if (leads[0]?.leadId) {
            await loadIntelligence(leads[0].leadId)
          } else {
            setSelectedLeadId(null)
            setError("Select a lead below — no queue or Datamoon import lead is available yet.")
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "No lead available for analysis.")
        } finally {
          setLoading(false)
        }
        return
      }

      await loadIntelligence(leadId)
    },
    [loadDatamoonLeads, loadIntelligence, suggestedLeadId],
  )

  return (
    <>
      <section
        data-qa-section="home-ava-opportunity-intelligence"
        data-qa-marker={GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER}
        className={cn(
          embedded
            ? "rounded-xl border border-border/60 bg-background/80 p-4 space-y-3"
            : "rounded-2xl border border-border/70 bg-card p-5 space-y-4",
        )}
      >
        {!embedded ? (
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_OPPORTUNITY_BRIEF_TITLE}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_OPPORTUNITY_BRIEF_SUBTITLE}</p>
          </div>
        </div>
        ) : (
          <p className="text-sm text-muted-foreground">{GROWTH_HOME_OPPORTUNITY_BRIEF_SUBTITLE}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="default" onClick={() => void openPanel("analyze")}>
            {GROWTH_HOME_AVA_ANALYZE_LEAD_LABEL}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void openPanel("datamoon")}>
            {GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void openPanel("show")}>
            {GROWTH_HOME_AVA_SHOW_INTELLIGENCE_LABEL}
          </Button>
        </div>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {mode === "datamoon"
                ? GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL
                : GROWTH_HOME_AVA_SHOW_INTELLIGENCE_LABEL}
            </SheetTitle>
            <SheetDescription>
              Aggregated from existing engines — qualification, revenue readiness, next best action, and research
              assessment when available.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {(mode === "datamoon" || !suggestedLeadId) && datamoonLeads.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {GROWTH_HOME_RECENT_IMPORTS_SECTION_LABEL}
                </p>
                <div className="flex flex-wrap gap-2">
                  {datamoonLeads.map((lead) => (
                    <Button
                      key={lead.leadId}
                      type="button"
                      size="sm"
                      variant={selectedLeadId === lead.leadId ? "default" : "outline"}
                      onClick={() => void loadIntelligence(lead.leadId)}
                    >
                      {lead.companyName ?? lead.contactName ?? lead.leadId.slice(0, 8)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading opportunity intelligence…
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {response?.viewModel ? (
              <>
                {selectedLeadId ? (
                  <GrowthHomeAvaSafeExecutionPanel
                    leadId={selectedLeadId}
                    onIntelligenceRefreshed={(payload) => {
                      if (payload.viewModel) setResponse(payload)
                    }}
                  />
                ) : null}
                <GrowthHomeOpportunityIntelligencePanel
                  viewModel={response.viewModel}
                  researchStatus={response.researchStatus}
                />
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
