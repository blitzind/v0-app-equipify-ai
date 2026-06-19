import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchNativeCallWorkspaceDashboard } from "@/lib/growth/native-dialer/native-dialer-dashboard-repository"
import type { CoachingLinkPipelineTelemetryContext } from "@/lib/growth/native-dialer/call-workspace-coaching-link-pipeline-telemetry"
import {
  answerNativeCallSession,
  type NativeCallAnswerResult,
  declineNativeCallSession,
  endNativeCallSession,
  fetchActiveNativeCallSession,
  listNativeDialerQueue,
  markNativeCallBridgeStarted,
  retryAnsweredInboundMediaStreamForNativeSession,
  saveNativeCallWrapup,
  startNativeCallSession,
  fetchNativeDialerSettingsRow,
  updateNativeDialerSettingsRow,
  updateNativeCallSessionNotesDraft,
  markNativeDialerQueueItemPreviewing,
  skipNativeDialerQueueItem,
  snoozeNativeDialerQueueItem,
  completeNativeDialerQueueItem,
  fetchNextNativeDialerQueueItem,
  scheduleNativeDialerCallbackQueueItem,
} from "@/lib/growth/native-dialer/native-dialer-repository"
import { emitNativeDialerNotifications } from "@/lib/growth/native-dialer/native-dialer-notifications"
import type { NativeCallWrapupInput } from "@/lib/growth/native-dialer/native-dialer-wrapup-engine"
import type {
  NativeCallWorkspaceDashboard,
  NativeCallWorkspaceSessionPublicView,
  NativeCallWrapupPublicView,
  NativeDialerLeadContext,
  NativeDialerProviderId,
  NativeDialerQueueItemPublicView,
  NativeDialerQueueMode,
} from "@/lib/growth/native-dialer/native-dialer-types"

export async function fetchGrowthNativeCallWorkspaceDashboard(
  admin: SupabaseClient,
  ownerUserId?: string | null,
): Promise<NativeCallWorkspaceDashboard> {
  return fetchNativeCallWorkspaceDashboard(admin, ownerUserId)
}

export async function fetchGrowthNativeDialerQueue(
  admin: SupabaseClient,
  input?: { limit?: number; modes?: NativeDialerQueueMode[] },
): Promise<NativeDialerQueueItemPublicView[]> {
  return listNativeDialerQueue(admin, input)
}

export async function startGrowthNativeCall(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    ownerUserId?: string | null
    phoneNumber: string
    dialMode?: NativeDialerQueueMode | "inbound"
    queueItemId?: string | null
    contactName?: string | null
    companyName?: string | null
    direction?: "outbound" | "inbound"
  },
): Promise<NativeCallWorkspaceSessionPublicView> {
  return startNativeCallSession(admin, input)
}

export async function answerGrowthNativeCall(
  admin: SupabaseClient,
  sessionId: string,
  ownerUserId?: string | null,
  pipelineTelemetry?: CoachingLinkPipelineTelemetryContext,
): Promise<NativeCallAnswerResult> {
  return answerNativeCallSession(admin, sessionId, ownerUserId, pipelineTelemetry)
}

export async function retryGrowthNativeCallMediaStream(
  admin: SupabaseClient,
  sessionId: string,
): Promise<{ started: boolean; reason: string; wssHost: string | null }> {
  return retryAnsweredInboundMediaStreamForNativeSession(admin, sessionId)
}

export async function declineGrowthNativeCall(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  return declineNativeCallSession(admin, sessionId)
}

export async function endGrowthNativeCall(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  return endNativeCallSession(admin, sessionId)
}

export async function markGrowthNativeCallBridgeStarted(
  admin: SupabaseClient,
  sessionId: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  return markNativeCallBridgeStarted(admin, sessionId)
}

export async function fetchGrowthNativeDialerSettings(admin: SupabaseClient) {
  return fetchNativeDialerSettingsRow(admin)
}

export async function updateGrowthNativeDialerSettings(
  admin: SupabaseClient,
  input: { primaryProvider?: NativeDialerProviderId; fallbackProvider?: NativeDialerProviderId },
) {
  return updateNativeDialerSettingsRow(admin, input)
}

export async function submitGrowthNativeCallWrapup(
  admin: SupabaseClient,
  input: { sessionId: string; ownerUserId?: string | null; wrapup: NativeCallWrapupInput; companyName?: string },
): Promise<NativeCallWrapupPublicView> {
  const wrapup = await saveNativeCallWrapup(admin, input)
  await emitNativeDialerNotifications(admin, {
    kind: "wrapup",
    wrapup,
    companyName: input.companyName ?? "Lead",
  })
  return wrapup
}

export async function fetchGrowthNativeDialerLeadContext(
  admin: SupabaseClient,
  leadId: string,
): Promise<NativeDialerLeadContext | null> {
  const [leadRes, dealRes, executionRes, outcomeRes, tasksRes] = await Promise.all([
    admin.schema("growth").from("leads").select("company_name, contact_name, contact_phone, next_best_action, workflow_health").eq("id", leadId).maybeSingle(),
    admin
      .schema("growth")
      .from("deal_intelligence_scores")
      .select("close_probability")
      .eq("lead_id", leadId)
      .eq("score_status", "active")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("growth")
      .from("human_execution_plans")
      .select("readiness_score")
      .eq("lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((result) => result)
      .catch(() => ({ data: null, error: null })),
    admin
      .schema("growth")
      .from("meeting_outcome_intelligence_scores")
      .select("meeting_outcome_score")
      .eq("lead_id", leadId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((result) => result)
      .catch(() => ({ data: null, error: null })),
    admin
      .schema("growth")
      .from("cadence_tasks")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("status", "pending"),
  ])

  if (!leadRes.data) return null
  return {
    leadId,
    companyName: leadRes.data.company_name as string,
    contactName: (leadRes.data.contact_name as string | null) ?? null,
    contactPhone: (leadRes.data.contact_phone as string | null) ?? null,
    researchSummary: null,
    dealCloseProbability: (dealRes.data?.close_probability as number | null) ?? null,
    executionReadinessScore: (executionRes.data?.readiness_score as number | null) ?? null,
    meetingOutcomeScore: (outcomeRes.data?.meeting_outcome_score as number | null) ?? null,
    recommendedNextAction: (leadRes.data.next_best_action as string | null) ?? null,
    opportunityHealth: (leadRes.data.workflow_health as string | null) ?? null,
    openTaskCount: tasksRes.count ?? 0,
  }
}

export {
  attachCallWorkspaceLead,
  fetchCallWorkspaceLiveCoaching,
  startCallWorkspaceLiveCoaching,
} from "@/lib/growth/native-dialer/call-workspace-coaching-service"
export { resolveCallWorkspaceLeadByPhone } from "@/lib/growth/native-dialer/call-workspace-phone-lead-resolve"

export async function updateGrowthNativeCallSessionNotes(
  admin: SupabaseClient,
  sessionId: string,
  notesDraft: string,
): Promise<NativeCallWorkspaceSessionPublicView> {
  return updateNativeCallSessionNotesDraft(admin, sessionId, notesDraft)
}

export async function applyGrowthNativeDialerQueueAction(
  admin: SupabaseClient,
  input: { queueItemId: string; action: "preview" | "skip" | "snooze" | "complete" },
): Promise<NativeDialerQueueItemPublicView | null> {
  switch (input.action) {
    case "preview":
      return markNativeDialerQueueItemPreviewing(admin, input.queueItemId)
    case "skip":
      return skipNativeDialerQueueItem(admin, input.queueItemId)
    case "snooze":
      return snoozeNativeDialerQueueItem(admin, input.queueItemId)
    case "complete":
      await completeNativeDialerQueueItem(admin, input.queueItemId)
      return null
    default:
      throw new Error("Unsupported queue action.")
  }
}

export async function fetchNextGrowthNativeDialerQueueItem(
  admin: SupabaseClient,
  input?: { excludeQueueItemId?: string | null; modes?: NativeDialerQueueMode[] },
): Promise<NativeDialerQueueItemPublicView | null> {
  return fetchNextNativeDialerQueueItem(admin, input)
}

export async function scheduleGrowthNativeDialerCallbackQueueItem(
  admin: SupabaseClient,
  input: {
    leadId: string
    phoneNumber: string
    contactName?: string | null
    companyName?: string | null
    callbackDueAt: string
    reason?: string
    ownerUserId?: string | null
  },
): Promise<NativeDialerQueueItemPublicView> {
  return scheduleNativeDialerCallbackQueueItem(admin, input)
}

export { fetchActiveNativeCallSession }
