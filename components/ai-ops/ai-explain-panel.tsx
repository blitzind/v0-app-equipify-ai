"use client"

/**
 * AI Ops Phase 2 — inline AI narration panel.
 *
 * Renders an expandable section under a `RecommendationCard` body
 * with the LLM-rewritten explanation + 2–4 next steps. Falls back
 * to the deterministic explanation if the AI provider is missing
 * or the org's plan/budget blocks the call.
 */

import { useState } from "react"
import { Bot, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Recommendation } from "@/lib/ai-ops/types"
import { logAiOpsOutcome } from "./log-outcome"

type Narration = {
  headline: string
  explanation: string
  next_steps: string[]
}

export function AiExplainPanel({
  rec,
  organizationId,
}: {
  rec: Recommendation
  organizationId: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Narration | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  async function explain() {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    setOpen(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/recommendations/${encodeURIComponent(rec.key)}/narrate`,
        { method: "POST" },
      )
      const body = (await res.json()) as {
        ok?: boolean
        narration?: Narration
        provider?: string | null
        warning?: string
        message?: string
        error?: string
        fallback?: Narration
      }
      if (body.narration) {
        setData(body.narration)
        setProvider(body.provider ?? null)
        setWarning(body.warning ?? null)
      } else if (body.fallback) {
        setData(body.fallback)
        setProvider(null)
        setWarning(body.error ?? "ai_unavailable")
      } else if (!res.ok) {
        throw new Error(body.message ?? body.error ?? "AI narration failed.")
      }
      logAiOpsOutcome(organizationId, rec, "narrated")
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI narration failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => (data ? setOpen((v) => !v) : void explain())}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" aria-hidden />}
        {loading
          ? "Asking AI…"
          : data
            ? open
              ? "Hide AI explanation"
              : "Show AI explanation"
            : "Explain with AI"}
      </Button>
      {open && (data || error) ? (
        <div className="rounded-md border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2.5 space-y-2">
          {error ? (
            <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          {data ? (
            <>
              <div className="flex items-start gap-2">
                <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-violet-900 dark:text-violet-100 leading-snug">
                    {data.headline}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed mt-1">
                    {data.explanation}
                  </p>
                </div>
              </div>
              {data.next_steps.length > 0 ? (
                <ol className="text-[11px] text-foreground/80 leading-relaxed list-decimal pl-4 space-y-0.5">
                  {data.next_steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              ) : null}
              <p className="text-[10px] text-muted-foreground pt-1 leading-snug">
                {warning === "ai_not_configured"
                  ? "AI provider not configured — showing deterministic fallback."
                  : warning === "plan_blocked"
                    ? "AI narration is not included on your current plan — showing fallback."
                    : warning === "budget_exceeded"
                      ? "Monthly AI budget reached — showing fallback."
                      : provider
                        ? `AI-assisted by Equipify · ${provider}`
                        : "Deterministic fallback shown."}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
