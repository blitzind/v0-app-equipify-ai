"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, Clock3, Compass, Sparkles, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import type {
  AiOsDailyBriefing,
  AiOsDailyBriefingActionItem,
  AiOsDailyBriefingUrgencyLevel,
} from "@/lib/growth/aios/ai-os-daily-briefing-types"
import { GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER } from "@/lib/growth/aios/ai-os-daily-briefing-types"
import { growthAvaEmptyRecommendations } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import { cn } from "@/lib/utils"

function urgencyBadgeVariant(urgency: AiOsDailyBriefingUrgencyLevel) {
  if (urgency === "high") return "destructive" as const
  if (urgency === "medium") return "secondary" as const
  return "outline" as const
}

function impactTone(impact: AiOsDailyBriefingActionItem["impact"]) {
  if (impact === "high") return "text-rose-700"
  if (impact === "medium") return "text-amber-700"
  return "text-muted-foreground"
}

function BriefingActionCard({
  item,
  rank,
}: {
  item: AiOsDailyBriefingActionItem
  rank?: number
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {rank != null ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Priority {rank}</p>
          ) : null}
          <p className="font-medium text-foreground">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.reason}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={urgencyBadgeVariant(item.urgency)}>{item.urgency} urgency</Badge>
          <span className={cn("text-xs font-medium capitalize", impactTone(item.impact))}>
            {item.impact} impact
          </span>
        </div>
      </div>
      {item.href && item.linkLabel ? (
        <Link href={item.href} className="mt-3 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {item.linkLabel}
        </Link>
      ) : null}
    </div>
  )
}

function BriefingListCard({
  title,
  description,
  emptyLabel,
  items,
  tone = "default",
}: {
  title: string
  description?: string
  emptyLabel: string
  items: AiOsDailyBriefingActionItem[]
  tone?: "default" | "warning"
}) {
  return (
    <Card className={cn(tone === "warning" && "border-amber-200/80 bg-amber-50/20")}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          items.map((item) => <BriefingActionCard key={item.id} item={item} />)
        )}
      </CardContent>
    </Card>
  )
}

export function GrowthAiOsDailyBriefingSection({ briefing }: { briefing: AiOsDailyBriefing }) {
  const { teammate } = useAiTeammateIdentity()
  return (
    <section
      className="space-y-6"
      data-qa-section="daily-briefing"
      data-qa-marker={GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER}
      aria-labelledby="ai-os-daily-briefing-heading"
    >
      <Card className="overflow-hidden border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-background to-background shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle id="ai-os-daily-briefing-heading" className="flex items-center gap-2 text-xl">
            <Sparkles className="size-5 text-indigo-600" />
            Daily Briefing
          </CardTitle>
          <CardDescription>Advisory summary from Alden — read-only, no execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold tracking-tight text-foreground">{briefing.executiveHeadline}</p>
          <p className="text-sm text-muted-foreground">{briefing.whatChangedSummary}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-indigo-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top 3 priorities</h3>
        </div>
        {briefing.topPriorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No urgent priorities — Alden is on track.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {briefing.topPriorities.map((item, index) => (
              <BriefingActionCard key={item.id} item={item} rank={index + 1} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BriefingListCard
          title="Needs approval"
          description="Work Orders waiting for your decision."
          emptyLabel="Nothing awaiting approval."
          items={briefing.needsApproval}
        />
        <BriefingListCard
          title="Blockers"
          description="Escalated or stalled items slowing missions."
          emptyLabel="No blockers detected."
          items={briefing.blockers}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Recent wins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {briefing.recentWins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent wins logged yet.</p>
            ) : (
              briefing.recentWins.map((win) => (
                <div key={win.id} className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-3">
                  <p className="font-medium">{win.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{win.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(win.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {briefing.risks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No elevated risks right now.</p>
            ) : (
              briefing.risks.map((risk) => (
                <div
                  key={risk.id}
                  className={cn(
                    "rounded-lg border p-3",
                    risk.severity === "high"
                      ? "border-rose-200 bg-rose-50/50"
                      : risk.severity === "medium"
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-border bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{risk.label}</p>
                    <Badge variant={risk.severity === "high" ? "destructive" : "secondary"}>{risk.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{risk.summary}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Compass className="size-4 text-indigo-600" />
            Recommended next actions
          </CardTitle>
          <CardDescription>Highest-value moves — links only, no execution from this surface.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {briefing.recommendedNextActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{growthAvaEmptyRecommendations(teammate)}</p>
          ) : (
            briefing.recommendedNextActions.map((item) => <BriefingActionCard key={item.id} item={item} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="size-4 text-muted-foreground" />
            Suggested links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {briefing.suggestedLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className="rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-muted/50 hover:text-indigo-700"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
