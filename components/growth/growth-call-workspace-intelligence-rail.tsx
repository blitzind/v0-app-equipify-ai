"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  Plus,
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
  CallWorkspaceLeadSearchDiagnostics,
  CallWorkspaceLeadSearchResult,
} from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import type {
  NativeCallWorkspaceSessionPublicView,
  NativeDialerLeadContext,
} from "@/lib/growth/native-dialer/native-dialer-types"
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

function LeadSearchResultRow({
  hit,
  attaching,
  onSelect,
}: {
  hit: CallWorkspaceLeadSearchResult
  attaching: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        data-qa-action="call-workspace-lead-search-result"
        disabled={attaching}
        onClick={onSelect}
        className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 text-xs">
          <span className="col-span-2 truncate text-sm font-medium">{hit.companyName}</span>
          <span className="truncate text-muted-foreground">{hit.contactName ?? "—"}</span>
          <GrowthBadge label={hit.entityType.replace(/_/g, " ")} tone="neutral" />
          <span className="truncate text-muted-foreground">{hit.contactEmail ?? "—"}</span>
          <span className="col-span-2 truncate text-muted-foreground">
            {hit.contactPhone ? formatDisplayPhone(hit.contactPhone) : "—"}
          </span>
        </div>
      </button>
    </li>
  )
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
  const [searchResults, setSearchResults] = useState<CallWorkspaceLeadSearchResult[]>([])
  const [searchDiagnostics, setSearchDiagnostics] = useState<CallWorkspaceLeadSearchDiagnostics | null>(null)
  const [searching, setSearching] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const autoAttachRef = useRef<string | null>(null)

  const attachLead = useCallback(
    async (leadId: string) => {
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
        setSearchDiagnostics(null)
      } catch (e) {
        setAttachError(e instanceof Error ? e.message : "Attach failed.")
      } finally {
        setAttachingId(null)
      }
    },
    [nativeSessionId, onLeadAttached],
  )

  const runSearch = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setSearchResults([])
        setSearchDiagnostics(null)
        return
      }
      setSearching(true)
      setAttachError(null)
      try {
        const res = await fetch(
          `/api/platform/growth/calls/workspace/leads/search?q=${encodeURIComponent(query.trim())}`,
          { cache: "no-store" },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          results?: CallWorkspaceLeadSearchResult[]
          diagnostics?: CallWorkspaceLeadSearchDiagnostics
          message?: string
        }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Search failed.")
        setSearchResults(data.results ?? [])
        setSearchDiagnostics(data.diagnostics ?? null)
        if (data.diagnostics) {
          console.info("[native-dialer-lead-search]", data.diagnostics)
        }
      } catch {
        setSearchResults([])
        setSearchDiagnostics(null)
      } finally {
        setSearching(false)
      }
    },
    [],
  )

  useEffect(() => {
    const id = window.setTimeout(() => void runSearch(searchQuery), 300)
    return () => window.clearTimeout(id)
  }, [searchQuery, runSearch])

  useEffect(() => {
    const autoId = searchDiagnostics?.autoSelectedLeadId
    if (!autoId || !nativeSessionId || leadContext) return
    if (autoAttachRef.current === autoId) return
    autoAttachRef.current = autoId
    void attachLead(autoId)
  }, [searchDiagnostics?.autoSelectedLeadId, nativeSessionId, leadContext, attachLead])

  const showEmpty =
    searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && !attachError

  const createProspectHref = `/admin/growth/leads?${new URLSearchParams({
    ...(searchQuery.trim() ? { companyName: searchQuery.trim() } : {}),
  }).toString()}`

  return (
    <section
      className={cn(GROWTH_CALL_WORKSPACE_PANEL, "w-full max-w-[320px] p-4 lg:justify-self-end")}
      data-google-voice-bridge-coaching-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER}
      data-native-dialer-lead-search-qa-marker={GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER}
    >
      <h3 className="mb-3 text-sm font-semibold">Prospect Intelligence</h3>

      {!leadContext ? (
        <div className="space-y-3" data-qa-action="call-workspace-attach-lead">
          <p className="text-sm leading-relaxed text-muted-foreground">
            No lead linked for this call
            {sessionPhone ? ` (${formatDisplayPhone(sessionPhone)})` : ""}. Search the full Growth lead dataset to
            attach a lead for intelligence and lead-linked coaching.
          </p>
          {nativeSessionId ? (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search company, contact, email, phone, domain"
                  className="pl-9"
                  data-qa-action="call-workspace-lead-search-input"
                />
              </div>
              {searching ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Searching Growth leads, prospects, contacts…
                </p>
              ) : null}
              {searchResults.length > 0 ? (
                <div className="rounded-lg border border-border/60 dark:border-white/10">
                  <div className="grid grid-cols-2 gap-2 border-b border-border/60 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-white/10">
                    <span>Company / Contact</span>
                    <span className="text-right">Email / Phone</span>
                  </div>
                  <ul className="max-h-56 overflow-auto p-1">
                    {searchResults.map((hit) => (
                      <LeadSearchResultRow
                        key={hit.leadId}
                        hit={hit}
                        attaching={attachingId === hit.leadId}
                        onSelect={() => void attachLead(hit.leadId)}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
              {showEmpty ? (
                <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center dark:border-white/10">
                  <p className="text-sm font-medium">No matching lead found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a partial company name, email, or normalized phone.
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                    <Link href={createProspectHref}>
                      <Plus className="mr-2 size-4" />
                      Create Prospect
                    </Link>
                  </Button>
                </div>
              ) : null}
              {searchDiagnostics?.autoSelectedLeadId ? (
                <p className="text-xs text-muted-foreground">
                  Auto-attaching high-confidence match…
                </p>
              ) : null}
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
