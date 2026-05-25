"use client"

import Link from "next/link"
import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  CheckSquare,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Target,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_CALL_WORKSPACE_PANEL,
  executionReadinessLabel,
  leadInitials,
  meetingOutcomeLabel,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type { NativeDialerLeadContext } from "@/lib/growth/native-dialer/native-dialer-types"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import { cn } from "@/lib/utils"

function IntelligenceRow({
  icon: Icon,
  label,
  value,
  badgeTone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  badgeTone?: "neutral" | "healthy" | "attention" | "medium"
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/50 py-2.5 last:border-b-0 dark:border-white/5">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
      <GrowthBadge label={value} tone={badgeTone} />
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
    </div>
  )
}

export function GrowthCallWorkspaceIntelligenceRail({
  leadContext,
}: {
  leadContext: NativeDialerLeadContext | null
}) {
  return (
    <section className={cn(GROWTH_CALL_WORKSPACE_PANEL, "w-full max-w-[320px] p-4 lg:justify-self-end")}>
      <h3 className="mb-3 text-sm font-semibold">Prospect Intelligence</h3>

      {!leadContext ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Select a lead to load deal, execution, and meeting outcome context.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border/50 p-3 dark:border-white/5">
            <Avatar className="size-11 shrink-0">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {leadInitials(leadContext.contactName, leadContext.companyName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{leadContext.contactName ?? "Contact"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {leadContext.opportunityHealth ?? "Prospect"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{leadContext.companyName}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs">
              <Link href={commandLeadFocusHref(leadContext.leadId, "command")}>View Lead</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-border/50 px-3 dark:border-white/5">
            <IntelligenceRow
              icon={BarChart3}
              label="Deal Intelligence"
              value={
                leadContext.dealCloseProbability != null
                  ? `${leadContext.dealCloseProbability}% close`
                  : "—"
              }
              badgeTone={
                leadContext.dealCloseProbability != null && leadContext.dealCloseProbability >= 60
                  ? "healthy"
                  : "medium"
              }
            />
            <IntelligenceRow
              icon={Briefcase}
              label="Execution Readiness"
              value={executionReadinessLabel(leadContext.executionReadinessScore)}
              badgeTone={
                leadContext.executionReadinessScore != null && leadContext.executionReadinessScore >= 70
                  ? "healthy"
                  : "medium"
              }
            />
            <IntelligenceRow
              icon={CalendarCheck}
              label="Meeting Outcome"
              value={meetingOutcomeLabel(leadContext.meetingOutcomeScore)}
              badgeTone={
                leadContext.meetingOutcomeScore != null && leadContext.meetingOutcomeScore >= 70
                  ? "healthy"
                  : leadContext.meetingOutcomeScore != null && leadContext.meetingOutcomeScore >= 40
                    ? "attention"
                    : "neutral"
              }
            />
            <IntelligenceRow
              icon={CheckSquare}
              label="Open Tasks"
              value={String(leadContext.openTaskCount)}
              badgeTone={leadContext.openTaskCount > 0 ? "attention" : "neutral"}
            />
            <IntelligenceRow icon={MessageSquare} label="Previous Conversations" value="—" />
            <IntelligenceRow icon={Sparkles} label="Buying Signals" value="—" />
          </div>

          <div className="rounded-xl border border-border/50 p-3 dark:border-white/5">
            <div className="mb-1 flex items-center gap-2">
              <Target className="size-3.5 text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recommended Next Action
              </p>
            </div>
            <p className="text-sm leading-snug">
              {leadContext.recommendedNextAction ?? "No recommendation yet — review lead command center."}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
