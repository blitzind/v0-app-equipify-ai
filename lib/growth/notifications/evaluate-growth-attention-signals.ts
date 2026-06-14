import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listUnassignedGrowthLeads } from "@/lib/growth/assignment/assignment-repository"
import { listGrowthRepRoster } from "@/lib/growth/assignment/rep-roster-repository"
import {
  emitGrowthCapacityWarningNotification,
  emitGrowthFollowupNeededNotification,
  emitGrowthHighFitLeadNotification,
  emitGrowthHighPriorityUnassignedNotification,
  emitGrowthWorkloadImbalanceNotification,
} from "@/lib/growth/notifications/notification-integrations"
import { syncGrowthProviderAttentionNotifications } from "@/lib/growth/notifications/sync-provider-attention"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { emitGrowthBuyingSignalDetectedNotification } from "@/lib/growth/notifications/notification-integrations"
import type { LeadSignalType, LeadSignalUrgency } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { externalSignalAttentionTier } from "@/lib/growth/signal-intelligence/external-signal-scoring"

function isHighPriorityUnassigned(row: {
  executive_priority_tier?: string | null
  call_priority_tier?: string | null
  score?: number | null
}): boolean {
  if (row.executive_priority_tier === "executive_now" || row.executive_priority_tier === "priority") return true
  if (row.call_priority_tier === "critical" || row.call_priority_tier === "high") return true
  return (row.score ?? 0) >= 70
}

function isHighFitUnassigned(row: { score?: number | null }): boolean {
  return (row.score ?? 0) >= 80
}

export async function evaluateGrowthAttentionSignals(
  admin: SupabaseClient,
  options?: {
    external_signal?: {
      lead_id: string
      signal_type: LeadSignalType
      urgency: LeadSignalUrgency
    } | null
  },
): Promise<{
  providerNotifications: number
  highPriorityUnassigned: number
  highFitWaiting: number
  capacityWarnings: number
  followUpsDue: number
  workloadImbalance: number
  externalSignalAlerts: number
}> {
  const [providerNotifications, unassigned, reps] = await Promise.all([
    syncGrowthProviderAttentionNotifications(admin),
    listUnassignedGrowthLeads(admin, 100),
    listGrowthRepRoster(admin),
  ])

  let highPriorityUnassigned = 0
  let highFitWaiting = 0
  for (const lead of unassigned) {
    if (isHighFitUnassigned(lead)) {
      await emitGrowthHighFitLeadNotification(admin, {
        leadId: lead.id,
        companyName: lead.company_name,
        fitScore: lead.score ?? 0,
      })
      highFitWaiting += 1
    }
    if (!isHighPriorityUnassigned(lead)) continue
    await emitGrowthHighPriorityUnassignedNotification(admin, {
      leadId: lead.id,
      companyName: lead.company_name,
      sourceId: lead.id,
    })
    highPriorityUnassigned += 1
  }

  let capacityWarnings = 0
  for (const rep of reps) {
    if (!rep.isOverCapacity) continue
    await emitGrowthCapacityWarningNotification(admin, {
      ownerUserId: rep.userId,
      repEmail: rep.email,
      activeLeadCount: rep.activeLeadCount,
      maxActiveLeads: rep.maxActiveLeads,
    })
    capacityWarnings += 1
  }

  const now = new Date().toISOString()
  const { data: overdueFollowUps, error: followUpError } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, follow_up_at, assigned_to")
    .not("follow_up_at", "is", null)
    .lt("follow_up_at", now)
    .not("assigned_to", "is", null)
    .not("status", "in", '("archived","converted","disqualified")')
    .limit(50)

  if (followUpError) throw new Error(followUpError.message)

  let followUpsDue = 0
  for (const row of overdueFollowUps ?? []) {
    await emitGrowthFollowupNeededNotification(admin, {
      leadId: row.id as string,
      companyName: row.company_name as string,
      followUpAt: row.follow_up_at as string,
      ownerUserId: row.assigned_to as string,
    })
    followUpsDue += 1
  }

  let workloadImbalance = 0
  const activeReps = reps.filter((rep) => rep.status === "active")
  if (activeReps.length >= 2) {
    const counts = activeReps.map((rep) => rep.activeLeadCount)
    const max = Math.max(...counts)
    const min = Math.min(...counts)
    const spread = max - min
    if (spread >= 10) {
      const maxRep = activeReps.find((rep) => rep.activeLeadCount === max)!
      const minRep = activeReps.find((rep) => rep.activeLeadCount === min)!
      await emitGrowthWorkloadImbalanceNotification(admin, {
        maxRepEmail: maxRep.email,
        minRepEmail: minRep.email,
        spread,
      })
      workloadImbalance = 1
    }
  }

  let externalSignalAlerts = 0
  const external = options?.external_signal
  if (external && (external.urgency === "urgent" || external.urgency === "high")) {
    const tier = externalSignalAttentionTier(external.signal_type)
    if (tier === "hot" || tier === "expansion") {
      const lead = await fetchGrowthLeadById(admin, external.lead_id)
      if (lead) {
        await emitGrowthBuyingSignalDetectedNotification(admin, {
          leadId: lead.id,
          companyName: lead.companyName,
          signalKey: external.signal_type,
          ownerUserId: lead.assignedTo,
        }).catch(() => undefined)
        externalSignalAlerts += 1
      }
    }
  }

  return {
    providerNotifications,
    highPriorityUnassigned,
    highFitWaiting,
    capacityWarnings,
    followUpsDue,
    workloadImbalance,
    externalSignalAlerts,
  }
}
