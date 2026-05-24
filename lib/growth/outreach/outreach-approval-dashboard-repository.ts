import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import {
  computeOutreachApprovalRate,
  computeOutreachChannelMix,
  computeOutreachExecutionRate,
  computeOutreachFailedExecutionRate,
  computeOutreachMedianTimeToApprovalMs,
  computeOutreachRegenerationHotspots,
  computeOutreachRegenerationRate,
} from "@/lib/growth/outreach/outreach-analytics"
import { listGrowthOutreachQueueItemsSince, listGrowthOutreachQueueItemsWithLead } from "@/lib/growth/outreach/outreach-queue-repository"
import { listGrowthProviderConnectionSummaries } from "@/lib/growth/outbound/provider-connection-repository"

export async function fetchGrowthOutreachApprovalDashboard(admin: SupabaseClient) {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const recentItems = await listGrowthOutreachQueueItemsSince(admin, since30d, 500)

  const pendingApproval = await listGrowthOutreachQueueItemsWithLead(admin, {
    statuses: ["pending_approval", "draft"],
    limit: 50,
  })
  const scheduled = await listGrowthOutreachQueueItemsWithLead(admin, {
    statuses: ["scheduled"],
    limit: 50,
  })
  const failed = await listGrowthOutreachQueueItemsWithLead(admin, {
    statuses: ["failed"],
    limit: 30,
  })
  const executedRecently = await listGrowthOutreachQueueItemsWithLead(admin, {
    statuses: ["executed"],
    limit: 30,
  })

  const providerConnections = await listGrowthProviderConnectionSummaries(admin)
  const providerHealth = providerConnections.map((connection) => ({
    id: connection.id,
    label: connection.label,
    provider: connection.provider,
    providerFamily: connection.providerFamily,
    lifecycleStatus: connection.health.lifecycleStatus,
    healthReason: connection.health.healthReason,
    temporarilyDegraded: connection.health.temporarilyDegraded,
    supportsSend: connection.health.capabilitySnapshot.supports_send,
    lastValidationAt: connection.health.lastValidationAt,
    validationFailureCount: connection.health.validationFailureCount,
  }))

  const draftGenerations = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .select("id, lead_id, generation_type, status, created_at")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(20)

  const pendingDraftApprovals = draftGenerations.data ?? []

  const regenerationHotspots = computeOutreachRegenerationHotspots(recentItems)

  const pendingDraftsWithLead = await Promise.all(
    pendingDraftApprovals.map(async (row) => {
      const { data: lead } = await admin
        .schema("growth")
        .from("leads")
        .select("company_name, executive_owner, source_vendor, call_priority_tier")
        .eq("id", row.lead_id as string)
        .maybeSingle()
      return {
        id: row.id as string,
        leadId: row.lead_id as string,
        generationType: row.generation_type as string,
        companyName: (lead?.company_name as string) ?? "—",
        executiveOwner: (lead?.executive_owner as string | null) ?? null,
        sourceVendor: (lead?.source_vendor as string | null) ?? null,
        callPriorityTier: (lead?.call_priority_tier as string | null) ?? null,
        createdAt: row.created_at as string,
      }
    }),
  )

  const executedWithGeneration = recentItems.filter((item) => item.generationId)
  const pendingExecutionDrafts = await Promise.all(
    executedWithGeneration
      .filter((item) => item.status === "approved" || item.status === "scheduled")
      .slice(0, 20)
      .map(async (item) => {
        const generation = item.generationId
          ? await fetchGrowthAiCopilotGenerationById(admin, item.generationId)
          : null
        return {
          queueId: item.id,
          generationId: item.generationId,
          generationStatus: generation?.status ?? null,
        }
      }),
  )

  const followUpDraftsPendingApproval = pendingDraftsWithLead.filter((entry) =>
    ["follow_up_email", "cold_email", "reengagement_email", "executive_email"].includes(entry.generationType),
  )

  return {
    sections: {
      pendingApproval,
      scheduled,
      failed,
      executedRecently,
      followUpDraftsPendingApproval,
    },
    analytics: {
      approvalRate: computeOutreachApprovalRate(recentItems),
      medianTimeToApprovalMs: computeOutreachMedianTimeToApprovalMs(recentItems),
      executionRate: computeOutreachExecutionRate(recentItems),
      failedExecutionRate: computeOutreachFailedExecutionRate(recentItems),
      regenerationRate: computeOutreachRegenerationRate(recentItems),
      channelMix: computeOutreachChannelMix(recentItems),
    },
    providerHealth,
    regenerationHotspots,
    pendingExecutionDrafts,
  }
}

export async function listGrowthOutreachQueueForLeadDrawer(admin: SupabaseClient, leadId: string) {
  const { listGrowthOutreachQueueItems, listGrowthOutreachQueueEvents } = await import(
    "@/lib/growth/outreach/outreach-queue-repository"
  )
  const items = await listGrowthOutreachQueueItems(admin, { leadId, limit: 10 })
  const historyByQueueId: Record<string, Awaited<ReturnType<typeof listGrowthOutreachQueueEvents>>> = {}
  for (const item of items) {
    historyByQueueId[item.id] = await listGrowthOutreachQueueEvents(admin, item.id)
  }
  return { queueItems: items, historyByQueueId }
}
