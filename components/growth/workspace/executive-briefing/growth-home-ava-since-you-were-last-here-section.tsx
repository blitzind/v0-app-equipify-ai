"use client"

import { Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
  type GrowthHomeAvaContinuousExecutiveBriefingPayload,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"

type Props = {
  briefing: GrowthHomeAvaContinuousExecutiveBriefingPayload
  onAcknowledge?: () => void
}

function statusTone(status: GrowthHomeAvaContinuousExecutiveBriefingPayload["continuousWorkStatus"]): string {
  if (status === "working_now") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
  }
  if (status === "waiting_for_operator") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
  }
  if (status === "outbound_disabled" || status === "waiting_for_business_hours") {
    return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100"
  }
  return "border-border bg-muted/30 text-foreground"
}

export function GrowthHomeAvaSinceYouWereLastHereSection({ briefing, onAcknowledge }: Props) {
  return (
    <section
      data-qa-section="home-ava-continuous-executive-briefing"
      data-qa-marker={GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER}
      data-qa-briefing-state={briefing.state}
      className="space-y-4 rounded-xl border border-indigo-200/80 bg-indigo-50/35 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-700 dark:text-indigo-200" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{briefing.title}</p>
            <p className="text-sm font-medium leading-relaxed text-foreground">{briefing.openingLine}</p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{briefing.sinceLabel}</p>
          <ul className="space-y-1.5 text-sm text-foreground" data-qa-field="briefing-activity-summary">
            {briefing.activitySummary.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {briefing.improvedSummary.length > 0 ? (
            <div data-qa-field="briefing-improved">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What improved</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {briefing.improvedSummary.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {briefing.declinedSummary.length > 0 ? (
            <div data-qa-field="briefing-declined">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What declined</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {briefing.declinedSummary.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {briefing.blockedSummary.length > 0 ? (
            <div data-qa-field="briefing-blocked">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What became blocked</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {briefing.blockedSummary.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {briefing.selfEvaluationLines.length > 0 ? (
            <div data-qa-field="briefing-self-evaluation">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How my last recommendation performed</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {briefing.selfEvaluationLines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {briefing.learningLines.length > 0 ? (
            <div data-qa-field="briefing-learning">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What I learned</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {briefing.learningLines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {briefing.standoutLine ? (
            <p className="text-sm leading-relaxed text-foreground" data-qa-field="briefing-standout">
              <span className="font-medium">One thing stands out · </span>
              {briefing.standoutLine}
            </p>
          ) : null}

          {briefing.objectiveStillCorrectLine ? (
            <p className="text-sm text-foreground" data-qa-field="briefing-objective-status">
              {briefing.objectiveStillCorrectLine}
            </p>
          ) : null}

          {briefing.planAdjustmentLine ? (
            <p className="text-sm text-foreground" data-qa-field="briefing-plan-adjustment">
              <span className="font-medium">My recommendation · </span>
              {briefing.planAdjustmentLine}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(briefing.continuousWorkStatus)}`}
              data-qa-field="briefing-continuous-work-status"
            >
              <Clock className="size-3" aria-hidden />
              {briefing.continuousWorkLabel}
            </span>
          </div>

          {briefing.communicationNote ? (
            <p className="text-sm text-muted-foreground" data-qa-field="briefing-communication-note">
              {briefing.communicationNote}
            </p>
          ) : null}

          {briefing.showAcknowledgeAction && onAcknowledge ? (
            <Button type="button" size="sm" variant="outline" onClick={onAcknowledge} data-qa-field="briefing-acknowledge">
              {briefing.state === "first_briefing" ? "Establish baseline" : "Mark briefing as reviewed"}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
