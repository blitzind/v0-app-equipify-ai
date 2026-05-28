"use client"

import { useCallback, useEffect, useState } from "react"
import { MessageSquare } from "lucide-react"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthCommandSectionLinks } from "@/components/growth/growth-command-section-links"
import { GROWTH_COMMAND_COMM_SECTION_LINKS } from "@/lib/growth/command/command-center-navigation"
import type { GrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-types"
import type { GrowthMeetingCommandSummary } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import type { GrowthAttentionDashboard } from "@/lib/growth/notifications/notification-types"
import {
  GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER,
  hasActionableCommunicationOpsMetrics,
} from "@/lib/growth/operator-ux/operator-attention-utils"

type CommunicationOpsData = {
  attention: GrowthAttentionDashboard | null
  replies: GrowthReplyInboxDashboard | null
  meetings: GrowthMeetingCommandSummary | null
  cadence: GrowthCadenceCommandSummary | null
  activeCallSessions: number
  providerIssues: number
  liveCoachingActive: boolean
}

const QUICK_LINKS = GROWTH_COMMAND_COMM_SECTION_LINKS

export function GrowthCommandCommunicationOpsSection() {
  const [data, setData] = useState<CommunicationOpsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [attentionRes, repliesRes, meetingsRes, cadenceRes, callsRes, providersRes] = await Promise.all([
        fetch("/api/platform/growth/attention/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/replies/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/meetings/command-summary", { cache: "no-store" }),
        fetch("/api/platform/growth/cadence/command-summary", { cache: "no-store" }),
        fetch("/api/platform/growth/calls/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/calls/providers/dashboard", { cache: "no-store" }),
      ])

      const attentionData = (await attentionRes.json().catch(() => ({}))) as { dashboard?: GrowthAttentionDashboard }
      const repliesData = (await repliesRes.json().catch(() => ({}))) as { dashboard?: GrowthReplyInboxDashboard }
      const meetingsData = (await meetingsRes.json().catch(() => ({}))) as { summary?: GrowthMeetingCommandSummary | null }
      const cadenceData = (await cadenceRes.json().catch(() => ({}))) as { summary?: GrowthCadenceCommandSummary | null }
      const callsData = (await callsRes.json().catch(() => ({}))) as {
        dashboard?: { activeSessions?: Array<{ status?: string }> }
      }
      const providersData = (await providersRes.json().catch(() => ({}))) as {
        dashboard?: { degradedCount?: number; disconnectedCount?: number }
      }

      const activeSessions = callsData.dashboard?.activeSessions ?? []
      const liveCoachingActive = activeSessions.some(
        (session) => session.status === "pre_call" || session.status === "in_call",
      )

      setData({
        attention: attentionData.dashboard ?? null,
        replies: repliesData.dashboard ?? null,
        meetings: meetingsData.summary ?? null,
        cadence: cadenceData.summary ?? null,
        activeCallSessions: activeSessions.length,
        providerIssues:
          (providersData.dashboard?.degradedCount ?? 0) + (providersData.dashboard?.disconnectedCount ?? 0) ||
          (attentionData.dashboard?.providerIssueCount ?? 0),
        liveCoachingActive,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasMetrics = hasActionableCommunicationOpsMetrics({
    criticalCount: data?.attention?.criticalCount,
    needsApprovalCount: data?.attention?.needsApprovalCount,
    myWorkCount: data?.attention?.myWorkCount,
    highPriorityReplies: data?.replies?.highPriorityCount,
    callTasksDue: data?.cadence?.callTasksDueCount,
    meetingsToday: data?.meetings?.meetingsTodayCount,
    cadenceDue: data?.cadence?.tasksDueTodayCount,
    overdueCadence: data?.cadence?.overdueCadenceTasksCount,
    providerIssues: data?.providerIssues,
    liveCoachingActive: data?.liveCoachingActive,
  })

  if (loading) {
    return null
  }

  if (!hasMetrics) {
    return null
  }

  return (
    <GrowthEngineCard
      title="Communication Operations"
      icon={<MessageSquare className="size-4" />}
      data-qa-marker={GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Attention, replies, calls, meetings, cadence, and provider health at a glance.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Needs attention"
          value={
            (data?.attention?.criticalCount ?? 0) +
            (data?.attention?.needsApprovalCount ?? 0) +
            (data?.attention?.myWorkCount ?? 0)
          }
        />
        <StatTile label="High priority replies" value={data?.replies?.highPriorityCount ?? 0} />
        <StatTile label="Calls due" value={data?.cadence?.callTasksDueCount ?? 0} />
        <StatTile label="Meetings today" value={data?.meetings?.meetingsTodayCount ?? 0} />
        <StatTile label="Cadence due" value={data?.cadence?.tasksDueTodayCount ?? 0} />
        <StatTile label="Overdue cadence" value={data?.cadence?.overdueCadenceTasksCount ?? 0} />
        <StatTile label="Provider issues" value={data?.providerIssues ?? 0} />
        <StatTile
          label="Live coaching"
          value={data?.liveCoachingActive ? "Active" : data?.activeCallSessions ? `${data.activeCallSessions} open` : "Idle"}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {data?.liveCoachingActive ? <GrowthBadge label="Session in progress" tone="healthy" /> : null}
        {(data?.providerIssues ?? 0) > 0 ? <GrowthBadge label="Check providers" tone="attention" /> : null}
      </div>
      <GrowthCommandSectionLinks links={QUICK_LINKS} className="mt-4" />
    </GrowthEngineCard>
  )
}
