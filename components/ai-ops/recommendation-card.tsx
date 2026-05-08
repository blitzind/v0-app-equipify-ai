"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ArrowRight,
  Bot,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Workflow,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import type { Recommendation } from "@/lib/ai-ops/types"
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  PRIORITY_BADGE,
  PRIORITY_ICON,
  PRIORITY_LABEL,
} from "./category-meta"
import { AiExplainPanel } from "./ai-explain-panel"
import { DraftFollowupDialog } from "./draft-followup-dialog"
import { buildAutomationSuggestion, suggestionUrl } from "./automation-suggestion"
import { logAiOpsOutcome } from "./log-outcome"
import { MarkHandledButton } from "./mark-handled-button"

const PRIORITY_RIBBON: Record<Recommendation["priority"], string> = {
  high: "before:bg-red-500",
  medium: "before:bg-amber-500",
  low: "before:bg-sky-500",
}

export function RecommendationCard({
  rec,
  canDismiss,
  onDismissed,
  organizationId,
  onOpenCommandCenter,
  canOpenCommandCenter,
}: {
  rec: Recommendation
  canDismiss: boolean
  organizationId: string
  onDismissed: (key: string) => void
  /** Phase 5 — opens command center drawer */
  onOpenCommandCenter?: (rec: Recommendation) => void
  canOpenCommandCenter?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const { permissions } = useOrgPermissions()
  const Icon = CATEGORY_ICON[rec.category]
  const PriorityIcon = PRIORITY_ICON[rec.priority]
  const primary = rec.actions[0]
  const extra = rec.actions.slice(1, 3)

  const automationSuggestion = buildAutomationSuggestion(rec)
  const canSuggestAutomation =
    Boolean(automationSuggestion) && Boolean(permissions.canManageAutomations)
  const canDraftFollowup =
    rec.category === "prospect" &&
    rec.entity?.type === "prospect" &&
    Boolean(permissions.canManageProspects)

  async function dismiss(snoozeHours: number | null) {
    if (!canDismiss) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/dismissals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: rec.key,
            category: rec.category,
            snoozeHours: snoozeHours === null ? 0 : snoozeHours,
          }),
        },
      )
      if (!res.ok) throw new Error("Failed to dismiss recommendation.")
      logAiOpsOutcome(organizationId, rec, snoozeHours === null ? "dismissed" : "snoozed", {
        snoozeHours,
      })
      onDismissed(rec.key)
    } catch {
      setBusy(false)
    }
  }

  function logOpen() {
    if (!organizationId || !rec.entity) return
    logAiOpsOutcome(organizationId, rec, "opened_entity", { entityId: rec.entity.id })
  }

  function logSuggestion() {
    if (!organizationId) return
    logAiOpsOutcome(organizationId, rec, "created_automation_suggestion")
  }

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        PRIORITY_RIBBON[rec.priority],
      )}
    >
      <div className="p-4 sm:p-5 space-y-3">
        <header className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              "border-border bg-muted/40",
            )}
            aria-hidden
          >
            <Icon className="h-4 w-4 text-foreground/80" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] gap-1">
                <PriorityIcon className={cn(
                  "h-3 w-3",
                  rec.priority === "high" && "text-red-600",
                  rec.priority === "medium" && "text-amber-600",
                  rec.priority === "low" && "text-sky-600",
                )} aria-hidden />
                {PRIORITY_LABEL[rec.priority]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {CATEGORY_LABEL[rec.category]}
              </Badge>
              {rec.confidence === "deterministic" ? (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Rule-based
                </Badge>
              ) : null}
              {rec.lifecycleState ? (
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {rec.lifecycleState.replace("_", " ")}
                </Badge>
              ) : null}
              {rec.commandScore != null ? (
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  Score {rec.commandScore}
                </Badge>
              ) : null}
            </div>
            <h3 className="text-sm font-semibold text-balance leading-snug text-foreground">
              {rec.title}
            </h3>
          </div>
          {canDismiss ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={busy} aria-label="More">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Snooze
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void dismiss(24)}>1 day</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void dismiss(24 * 3)}>3 days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void dismiss(24 * 7)}>1 week</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void dismiss(24 * 30)}>30 days</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void dismiss(null)} className="text-red-600 focus:text-red-700">
                  <X className="h-3.5 w-3.5 mr-2" /> Dismiss indefinitely
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </header>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {rec.explanation}
        </p>

        {(rec.entity || rec.metric) && (
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {rec.entity ? (
              <Link
                href={rec.entity.href}
                onClick={logOpen}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-foreground/80 hover:text-foreground hover:border-primary/30"
              >
                <span className="truncate max-w-[12rem]">{rec.entity.label}</span>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              </Link>
            ) : null}
            {rec.metric ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="uppercase tracking-wide text-[10px]">{rec.metric.label}</span>
                <span className="font-semibold text-foreground">{rec.metric.value}</span>
              </span>
            ) : null}
          </div>
        )}

        {organizationId ? <AiExplainPanel rec={rec} organizationId={organizationId} /> : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canOpenCommandCenter && onOpenCommandCenter ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1"
              onClick={() => onOpenCommandCenter(rec)}
            >
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
              Command center
            </Button>
          ) : null}
          {primary ? (
            <Button asChild size="sm" className="h-8 gap-1" onClick={logOpen}>
              <Link href={primary.href ?? "#"}>
                {primary.label}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </Button>
          ) : null}
          {canDraftFollowup ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setDraftOpen(true)}
            >
              <Bot className="h-3 w-3" aria-hidden /> Draft AI follow-up
            </Button>
          ) : null}
          {canSuggestAutomation && automationSuggestion ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={logSuggestion}
            >
              <Link href={suggestionUrl(organizationId, automationSuggestion)}>
                <Workflow className="h-3 w-3" aria-hidden /> Suggest automation
              </Link>
            </Button>
          ) : null}
          {extra.map((a, i) => (
            <Button key={`${a.type}-${i}`} asChild variant="outline" size="sm" className="h-8">
              <Link href={a.href ?? "#"}>{a.label}</Link>
            </Button>
          ))}
          {organizationId ? (
            <MarkHandledButton rec={rec} organizationId={organizationId} />
          ) : null}
        </div>
      </div>

      {canDraftFollowup ? (
        <DraftFollowupDialog
          open={draftOpen}
          onOpenChange={setDraftOpen}
          rec={rec}
          organizationId={organizationId}
        />
      ) : null}
    </article>
  )
}
