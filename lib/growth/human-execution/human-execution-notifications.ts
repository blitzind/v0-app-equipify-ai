import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import { buildGrowthCallWorkspaceHref, buildGrowthLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import type { HumanExecutionApprovalItem } from "@/lib/growth/human-execution/human-execution-types"

export async function emitHumanExecutionReadyNotification(
  admin: SupabaseClient,
  item: HumanExecutionApprovalItem,
): Promise<void> {
  await emitGrowthNotification(admin, {
    leadId: item.leadId,
    ownerUserId: item.ownerUserId,
    notificationType: "execution_ready",
    title: "Execution ready",
    body: `${item.companyName}: ${item.title} is approved and ready for operator execution.`,
    sourceSystem: "human_execution",
    sourceId: item.id,
    actionUrl: item.ctaHref,
    metadata: { channel: item.channel, readinessScore: item.readinessScore },
  })
}

export async function emitHumanExecutionApprovalNeededNotification(
  admin: SupabaseClient,
  item: HumanExecutionApprovalItem,
): Promise<void> {
  await emitGrowthNotification(admin, {
    leadId: item.leadId,
    ownerUserId: item.ownerUserId,
    notificationType: "execution_approval_needed",
    title: "Execution approval needed",
    body: `${item.companyName}: ${item.title} requires operator review.`,
    sourceSystem: "human_execution",
    sourceId: item.id,
    actionUrl: item.ctaHref,
    metadata: { channel: item.channel, readinessBand: item.readinessBand },
  })
}

export async function emitHumanExecutionStalledNotification(
  admin: SupabaseClient,
  item: HumanExecutionApprovalItem,
  reason: string,
): Promise<void> {
  await emitGrowthNotification(admin, {
    leadId: item.leadId,
    ownerUserId: item.ownerUserId,
    notificationType: "execution_stalled",
    title: "Execution stalled",
    body: `${item.companyName}: ${reason}`,
    sourceSystem: "human_execution",
    sourceId: item.id,
    actionUrl: item.ctaHref,
    metadata: { reason },
  })
}

export async function emitHumanExecutionFatigueNotification(
  admin: SupabaseClient,
  input: { leadId: string; companyName: string; ownerUserId?: string | null; reason: string },
): Promise<void> {
  await emitGrowthNotification(admin, {
    leadId: input.leadId,
    ownerUserId: input.ownerUserId ?? null,
    notificationType: "fatigue_protection_triggered",
    title: "Contact fatigue protection",
    body: `${input.companyName}: ${input.reason}`,
    sourceSystem: "human_execution",
    sourceId: input.leadId,
    actionUrl: buildGrowthLeadHref(input.leadId, { focus: "execution" }),
    metadata: { reason: input.reason },
  })
}

export async function emitHumanExecutionCallNowNotification(
  admin: SupabaseClient,
  input: { leadId: string; companyName: string; ownerUserId?: string | null; readinessScore: number },
): Promise<void> {
  await emitGrowthNotification(admin, {
    leadId: input.leadId,
    ownerUserId: input.ownerUserId ?? null,
    notificationType: "call_now_opportunity",
    title: "Call-now opportunity",
    body: `${input.companyName}: readiness ${input.readinessScore}/100 — operator call recommended.`,
    sourceSystem: "human_execution",
    sourceId: input.leadId,
    actionUrl: buildGrowthCallWorkspaceHref({ leadId: input.leadId }),
    metadata: { readinessScore: input.readinessScore },
  })
}
