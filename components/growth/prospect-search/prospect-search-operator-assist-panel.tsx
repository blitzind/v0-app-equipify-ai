"use client"

import { AlertCircle, ClipboardList, RefreshCw, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProspectSearchOperatorAssistBundle } from "@/lib/growth/prospect-search/prospect-search-operator-assist-intelligence"
import { GROWTH_OPERATOR_RECOMMENDATIONS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-operator-recommendations"
import { GROWTH_SMART_RESEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-research-gaps"
import { GROWTH_ADAPTIVE_REFRESH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-adaptive-refresh"
import { GROWTH_PROSPECT_COMMAND_OVERLAYS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-command-overlays"

function urgencyVariant(level: string): "default" | "outline" | "secondary" | "destructive" {
  if (level === "high" || level === "critical") return "destructive"
  if (level === "moderate") return "secondary"
  return "outline"
}

export function ProspectSearchOperatorAssistPanel({
  assist,
  compact = false,
  onResearchAction,
}: {
  assist: ProspectSearchOperatorAssistBundle | null | undefined
  compact?: boolean
  onResearchAction?: (actionId: string) => void
}) {
  if (!assist) return null

  const top = assist.operator_recommendations.top_recommendation
  const researchTasks = assist.research_gaps.tasks
  const overlays = assist.command_overlays.overlays

  if (!top && researchTasks.length === 0 && !assist.adaptive_refresh.refresh_recommended) {
    return null
  }

  return (
    <section
      className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
      data-operator-recommendations-marker={GROWTH_OPERATOR_RECOMMENDATIONS_QA_MARKER}
      data-smart-research-marker={GROWTH_SMART_RESEARCH_QA_MARKER}
      data-adaptive-refresh-marker={GROWTH_ADAPTIVE_REFRESH_QA_MARKER}
      data-prospect-command-overlays-marker={GROWTH_PROSPECT_COMMAND_OVERLAYS_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-indigo-800" />
        <h4 className="text-sm font-semibold text-indigo-950">Operator assist</h4>
        {overlays.length > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {overlays[0]?.label}
          </Badge>
        ) : null}
      </div>

      {top ? (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={urgencyVariant(top.urgency)}>{top.urgency}</Badge>
            <Badge variant="outline">{Math.round(top.confidence * 100)}% confidence</Badge>
            <span className="font-medium text-indigo-950">{top.title}</span>
          </div>
          <p className="mt-2 font-medium">{top.recommended_operator_action}</p>
          <p className="mt-1 text-muted-foreground">Timing: {top.recommended_timing}</p>
          {!compact && top.reasoning.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {top.reasoning.slice(0, 2).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {!compact && top.evidence.length > 0 ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Evidence: {top.evidence.slice(0, 2).join(" · ")}
            </p>
          ) : null}
          {top.blocker_explanations.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-amber-900">
              {top.blocker_explanations.slice(0, 2).map((blocker) => (
                <li key={blocker}>Blocker: {blocker}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {assist.adaptive_refresh.refresh_recommended ? (
        <div className="mt-3 flex gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs">
          <RefreshCw className="mt-0.5 size-3 shrink-0 text-indigo-800" />
          <div>
            <p className="font-medium">Refresh recommended</p>
            <p className="text-muted-foreground">{assist.adaptive_refresh.refresh_timing_rationale}</p>
            {!compact && assist.adaptive_refresh.refresh_reasons.length > 0 ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {assist.adaptive_refresh.refresh_reasons.slice(0, 2).join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {researchTasks.length > 0 && !compact ? (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs">
          <div className="flex items-center gap-2 font-medium text-indigo-950">
            <ClipboardList className="size-3.5" />
            Research priorities
          </div>
          <p className="mt-1 text-muted-foreground">{assist.research_gaps.summary}</p>
          <ul className="mt-2 space-y-1.5">
            {researchTasks.slice(0, 4).map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <span>{task.label}</span>
                <div className="flex items-center gap-1">
                  <Badge variant={urgencyVariant(task.urgency)} className="text-[10px]">
                    {task.urgency}
                  </Badge>
                  {onResearchAction ? (
                    <button
                      type="button"
                      className="text-[10px] font-medium text-indigo-700 underline"
                      onClick={() => onResearchAction(task.action_kind)}
                    >
                      Start
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assist.operator_recommendations.recommendations.length > 1 && !compact ? (
        <ul className="mt-3 space-y-1.5">
          {assist.operator_recommendations.recommendations.slice(1, 4).map((rec) => (
            <li
              key={rec.id}
              className="flex gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs"
            >
              <AlertCircle className="mt-0.5 size-3 shrink-0 text-indigo-700" />
              <div>
                <p className="font-medium">{rec.title}</p>
                <p className="text-muted-foreground">{rec.recommended_operator_action}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
