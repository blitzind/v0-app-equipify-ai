"use client"

import { useCallback, useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import type {
  ProspectSearchIntent,
  ProspectSearchPlan,
  ProspectSearchSuggestion,
} from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { PROSPECT_DISCOVERY_QA_MARKER } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"
import { cn } from "@/lib/utils"

const EXAMPLE_QUERIES = [
  "Find biomedical companies with hiring signals.",
  "Find HVAC companies in Texas with 20+ technicians.",
  "Find manufacturing service companies that use Salesforce and recently raised funding.",
] as const

function qualityTone(quality: string): "critical" | "high" | "attention" | "neutral" {
  if (quality === "high") return "high"
  if (quality === "medium") return "attention"
  return "neutral"
}

function ChipList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={`${label}-${value}`}
            className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px]"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  )
}

export function NaturalLanguageDiscoveryPanel({
  onApplyFilters,
  onApprovePlan,
  compact = false,
}: {
  onApplyFilters?: (filters: GrowthProspectSearchFilters) => void
  onApprovePlan?: (plan: ProspectSearchPlan) => void
  compact?: boolean
}) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [intent, setIntent] = useState<ProspectSearchIntent | null>(null)
  const [plan, setPlan] = useState<ProspectSearchPlan | null>(null)
  const [suggestions, setSuggestions] = useState<ProspectSearchSuggestion[]>([])
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSuggestions = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([])
      return
    }
    try {
      const params = new URLSearchParams({ query: value.trim() })
      const res = await fetch(`/api/platform/growth/prospect-discovery/suggestions?${params}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as { suggestions?: ProspectSearchSuggestion[] }
      setSuggestions(res.ok && data.suggestions ? data.suggestions : [])
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSuggestions(query)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [loadSuggestions, query])

  const runPlanning = useCallback(async () => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setError("Enter at least 3 characters.")
      return
    }
    setLoading(true)
    setError(null)
    setApproved(false)
    try {
      const parseRes = await fetch("/api/platform/growth/prospect-discovery/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      })
      const parseData = (await parseRes.json().catch(() => ({}))) as {
        ok?: boolean
        intent?: ProspectSearchIntent
        message?: string
      }
      if (!parseRes.ok || !parseData.intent) {
        setError(parseData.message ?? "Parse failed.")
        setIntent(null)
        setPlan(null)
        return
      }
      setIntent(parseData.intent)

      const planRes = await fetch("/api/platform/growth/prospect-discovery/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: parseData.intent }),
      })
      const planData = (await planRes.json().catch(() => ({}))) as {
        ok?: boolean
        plan?: ProspectSearchPlan
        message?: string
      }
      if (!planRes.ok || !planData.plan) {
        setError(planData.message ?? "Plan build failed.")
        setPlan(null)
        return
      }
      setPlan(planData.plan)
    } catch {
      setError("Planning request failed.")
      setIntent(null)
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleEditFilters = useCallback(() => {
    if (!plan?.normalized_intent.prospect_search_filters) return
    onApplyFilters?.(plan.normalized_intent.prospect_search_filters)
  }, [onApplyFilters, plan])

  const handleApprovePlan = useCallback(() => {
    if (!plan) return
    setApproved(true)
    onApprovePlan?.(plan)
  }, [onApprovePlan, plan])

  return (
    <GrowthEngineCard
      title="Natural Language Discovery"
      data-qa-marker={PROSPECT_DISCOVERY_QA_MARKER}
      className={cn(compact ? "text-sm" : undefined)}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Describe your ideal prospect in plain English. GS-2A produces a search plan only — no search execution,
        enrollment, or outreach until you approve in a future phase.
      </p>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder='e.g. "Find biomedical companies with hiring signals."'
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLE_QUERIES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setQuery(example)}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-muted"
          >
            {example.slice(0, 42)}…
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void runPlanning()}
          disabled={loading || query.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {loading ? "Planning…" : "Build Search Plan"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {suggestions.length > 0 && !plan ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-xs font-medium">Suggestions</p>
          <ul className="space-y-2">
            {suggestions.slice(0, 4).map((s) => (
              <li key={s.id} className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{s.label}</span> — {s.reason}
                {s.examples[0] ? (
                  <button
                    type="button"
                    className="ml-1 text-violet-600 hover:underline"
                    onClick={() => setQuery((prev) => `${prev.trim()} ${s.examples[0]}`.trim())}
                  >
                    + {s.examples[0]}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intent && plan ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge tone={qualityTone(plan.estimated_result_quality)}>
              Quality: {plan.estimated_result_quality}
            </GrowthBadge>
            <GrowthBadge tone="neutral">Confidence: {Math.round(intent.confidence * 100)}%</GrowthBadge>
            {approved ? <GrowthBadge tone="high">Plan approved</GrowthBadge> : null}
          </div>

          <div className="space-y-3 rounded-lg bg-muted/30 p-3">
            <p className="text-xs font-semibold">Parsed Filters</p>
            <ChipList label="Industries" values={intent.industries} />
            <ChipList label="Locations" values={intent.locations.slice(0, 6)} />
            <ChipList label="Employee ranges" values={intent.employee_ranges} />
            <ChipList label="Technologies" values={intent.technologies} />
            <ChipList label="Signals" values={intent.signals} />
            <ChipList label="Keywords" values={intent.keywords.slice(0, 8)} />
            <ChipList label="Titles" values={intent.titles} />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold">Discovery Providers</p>
            <div className="flex flex-wrap gap-1.5">
              {plan.discovery_providers.map((provider) => (
                <span key={provider} className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] dark:border-violet-900 dark:bg-violet-950/40">
                  {provider.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>

          {intent.assumptions.length ? (
            <div>
              <p className="mb-1 text-xs font-semibold">Assumptions</p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                {intent.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {intent.ambiguities.length ? (
            <div>
              <p className="mb-1 text-xs font-semibold">Ambiguities</p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-amber-700 dark:text-amber-400">
                {intent.ambiguities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan.warnings.length ? (
            <div>
              <p className="mb-1 text-xs font-semibold">Warnings</p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                {plan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan.recommendations.length ? (
            <div>
              <p className="mb-1 text-xs font-semibold">Recommendations</p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                {plan.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEditFilters}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Edit Filters
            </button>
            <button
              type="button"
              onClick={handleApprovePlan}
              disabled={approved}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {approved ? "Plan Approved" : "Approve Plan"}
            </button>
          </div>
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}
