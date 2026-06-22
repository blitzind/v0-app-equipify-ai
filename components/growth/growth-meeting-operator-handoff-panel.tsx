"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Activity, Briefcase, Loader2, Phone, Sparkles, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthNextBestActionBanner } from "@/components/growth/growth-next-best-action-banner"
import { GrowthMeetingOutcomeIntelligenceInline } from "@/components/growth/growth-meeting-outcome-intelligence-inline"
import { GrowthPersonalizationEmbeddedPanel } from "@/components/growth/personalization/embedded/growth-personalization-embedded-panel"
import {
  buildGrowthActivityHref,
  buildGrowthCallWorkspaceHref,
  buildGrowthLeadHref,
  buildGrowthOpportunityHref,
  buildGrowthPersonalizationHref,
  GROWTH_OPS_HANDOFF_6C_QA_MARKER,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import type { MeetingOutcomeIntelligenceScorePublicView } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_MEETING_OPERATOR_HANDOFF_PANEL_QA_MARKER =
  "growth-meeting-operator-handoff-panel-v1" as const

type GrowthMeetingOperatorHandoffPanelProps = {
  meeting: GrowthMeeting
  meetingOutcomeScore?: MeetingOutcomeIntelligenceScorePublicView | null
}

export function GrowthMeetingOperatorHandoffPanel({
  meeting,
  meetingOutcomeScore = null,
}: GrowthMeetingOperatorHandoffPanelProps) {
  const [lead, setLead] = useState<GrowthLead | null>(null)
  const [leadLoading, setLeadLoading] = useState(true)
  const [outcome, setOutcome] = useState(meeting.outcome ?? "")
  const [nextAction, setNextAction] = useState(meeting.nextAction ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLead = useCallback(async () => {
    setLeadLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/leads/${meeting.leadId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; lead?: GrowthLead }
      setLead(res.ok && data.ok && data.lead ? data.lead : null)
    } catch {
      setLead(null)
    } finally {
      setLeadLoading(false)
    }
  }, [meeting.leadId])

  useEffect(() => {
    void loadLead()
  }, [loadLead])

  useEffect(() => {
    setOutcome(meeting.outcome ?? "")
    setNextAction(meeting.nextAction ?? "")
  }, [meeting.id, meeting.outcome, meeting.nextAction])

  async function saveOutcome() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: outcome.trim() || null,
          nextAction: nextAction.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not save meeting outcome.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  const opportunityHref = meeting.opportunityId
    ? buildGrowthOpportunityHref({ opportunityId: meeting.opportunityId })
    : buildGrowthOpportunityHref({ leadId: meeting.leadId })

  return (
    <div
      className="space-y-4 rounded-lg border border-border bg-card p-3"
      data-qa-marker={GROWTH_MEETING_OPERATOR_HANDOFF_PANEL_QA_MARKER}
      data-growth-ops-handoff={GROWTH_OPS_HANDOFF_6C_QA_MARKER}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operator handoff</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture outcome, personalize follow-up, and continue in adjacent workspaces.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
          <Link href={buildGrowthLeadHref(meeting.leadId, { focus: "meetings", highlight: meeting.id })}>
            <UserRound className="mr-1 size-3" />
            Open Lead
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
          <Link href={buildGrowthCallWorkspaceHref({ leadId: meeting.leadId })}>
            <Phone className="mr-1 size-3" />
            Start Call
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
          <Link href={buildGrowthPersonalizationHref(meeting.leadId)}>
            <Sparkles className="mr-1 size-3" />
            Personalization
          </Link>
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
          <Link href={buildGrowthActivityHref({ leadId: meeting.leadId })}>
            <Activity className="mr-1 size-3" />
            Activity
          </Link>
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
          <Link href={opportunityHref}>
            <Briefcase className="mr-1 size-3" />
            Opportunity
          </Link>
        </Button>
      </div>

      {leadLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading lead context…
        </div>
      ) : lead ? (
        <>
          {lead.nextBestAction ? <GrowthNextBestActionBanner lead={lead} /> : null}
          <GrowthPersonalizationEmbeddedPanel leadId={meeting.leadId} surface="meeting" compact />
        </>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Outcome & next action</p>
        <Textarea
          placeholder="Outcome (human-entered)"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          rows={2}
        />
        <Input placeholder="Next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <Button size="sm" disabled={saving || !outcome.trim()} onClick={() => void saveOutcome()}>
          {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
          Save outcome
        </Button>
      </div>

      {meetingOutcomeScore ? <GrowthMeetingOutcomeIntelligenceInline score={meetingOutcomeScore} /> : null}
    </div>
  )
}
