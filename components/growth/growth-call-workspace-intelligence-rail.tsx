"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  CheckSquare,
  ChevronRight,
  Link2,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Target,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_CALL_WORKSPACE_PANEL,
  executionReadinessLabel,
  formatDisplayPhone,
  leadInitials,
  meetingOutcomeLabel,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type {
  NativeCallWorkspaceSessionPublicView,
  NativeDialerLeadContext,
} from "@/lib/growth/native-dialer/native-dialer-types"
import { GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
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

type LeadSearchHit = {
  leadId: string
  companyName: string
  contactName: string | null
  contactPhone: string | null
}

export function GrowthCallWorkspaceIntelligenceRail({
  leadContext,
  nativeSessionId,
  sessionPhone,
  onLeadAttached,
}: {
  leadContext: NativeDialerLeadContext | null
  nativeSessionId?: string | null
  sessionPhone?: string | null
  onLeadAttached?: (leadId: string, session?: NativeCallWorkspaceSessionPublicView) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<LeadSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    setAttachError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/calls/workspace/leads/search?q=${encodeURIComponent(query.trim())}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; leads?: LeadSearchHit[] }
      setSearchResults(data.leads ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => void runSearch(searchQuery), 300)
    return () => window.clearTimeout(id)
  }, [searchQuery, runSearch])

  async function attachLead(leadId: string) {
    if (!nativeSessionId) return
    setAttachingId(leadId)
    setAttachError(null)
    try {
      const res = await fetch(`/api/platform/growth/calls/sessions/${nativeSessionId}/attach-lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        session?: NativeCallWorkspaceSessionPublicView
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not attach lead.")
      onLeadAttached?.(leadId, data.session)
      setSearchQuery("")
      setSearchResults([])
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : "Attach failed.")
    } finally {
      setAttachingId(null)
    }
  }

  return (
    <section
      className={cn(GROWTH_CALL_WORKSPACE_PANEL, "w-full max-w-[320px] p-4 lg:justify-self-end")}
      data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
    >
      <h3 className="mb-3 text-sm font-semibold">Prospect Intelligence</h3>

      {!leadContext ? (
        <div className="space-y-3" data-qa-action="call-workspace-attach-lead">
          <p className="text-sm leading-relaxed text-muted-foreground">
            No lead linked for this call
            {sessionPhone ? ` (${formatDisplayPhone(sessionPhone)})` : ""}. Attach a lead for deal, execution, and
            meeting intelligence, or use transcript-only coaching.
          </p>
          {nativeSessionId ? (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads by company, name, or phone"
                  className="pl-9"
                />
              </div>
              {searching ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Searching…
                </p>
              ) : null}
              {searchResults.length > 0 ? (
                <ul className="max-h-48 space-y-1 overflow-auto rounded-lg border border-border/60 p-1 dark:border-white/10">
                  {searchResults.map((hit) => (
                    <li key={hit.leadId}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start px-2 py-2 text-left"
                        disabled={attachingId === hit.leadId}
                        onClick={() => void attachLead(hit.leadId)}
                      >
                        <span className="block truncate text-sm font-medium">{hit.companyName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {hit.contactName ?? "—"}
                          {hit.contactPhone ? ` · ${formatDisplayPhone(hit.contactPhone)}` : ""}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                <Link href="/admin/growth/leads">
                  <Link2 className="mr-2 size-4" />
                  Attach Lead — open leads inbox
                </Link>
              </Button>
              {attachError ? <p className="text-xs text-destructive">{attachError}</p> : null}
            </>
          ) : null}
        </div>
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
