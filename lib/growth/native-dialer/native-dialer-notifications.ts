import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import { growthCallNotificationActionHref, growthWorkspaceCallWorkspaceHref } from "@/lib/growth/navigation/growth-call-notification-links"
import type { NativeCallWrapupPublicView, NativeDialerQueueItemPublicView } from "@/lib/growth/native-dialer/native-dialer-types"

export async function emitNativeDialerNotifications(
  admin: SupabaseClient,
  input:
    | { kind: "wrapup"; wrapup: NativeCallWrapupPublicView; companyName: string }
    | { kind: "queue_item"; item: NativeDialerQueueItemPublicView },
): Promise<void> {
  if (input.kind === "wrapup") {
    const { wrapup, companyName } = input
    if (wrapup.meetingBooked) {
      await emitGrowthNotification(admin, {
        leadId: wrapup.leadId,
        ownerUserId: null,
        notificationType: "meeting_booked_from_call",
        title: "Meeting booked from call",
        body: `${companyName}: operator confirmed meeting booked — review follow-up plan.`,
        sourceSystem: "intelligence",
        sourceId: wrapup.id,
        actionUrl: wrapup.leadId
          ? growthWorkspaceCallWorkspaceHref({ leadId: wrapup.leadId })
          : growthWorkspaceCallWorkspaceHref(),
        metadata: { sessionId: wrapup.sessionId },
      })
    }
    return
  }

  const { item } = input
  if (item.queueMode === "callback" || item.queueMode === "missed_callback") {
    await emitGrowthNotification(admin, {
      leadId: item.leadId,
      ownerUserId: item.ownerUserId,
      notificationType: item.queueMode === "missed_callback" ? "missed_callback" : "callback_due",
      title: item.queueMode === "missed_callback" ? "Missed callback" : "Callback due",
      body: `${item.companyName ?? "Lead"}: ${item.reason}`,
      sourceSystem: "intelligence",
      sourceId: item.id,
      actionUrl: growthCallNotificationActionHref({
        notificationType: item.queueMode === "missed_callback" ? "missed_callback" : "callback_due",
        leadId: item.leadId,
        queueItemId: item.id,
        phone: item.phoneNumber,
      }),
      metadata: { queueMode: item.queueMode },
    })
    return
  }

  if (item.queueMode === "priority" && item.priorityScore >= 70) {
    await emitGrowthNotification(admin, {
      leadId: item.leadId,
      ownerUserId: item.ownerUserId,
      notificationType: "priority_call_ready",
      title: "Priority call ready",
      body: `${item.companyName ?? "Lead"}: ${item.reason}`,
      sourceSystem: "intelligence",
      sourceId: item.id,
      actionUrl: growthCallNotificationActionHref({
        notificationType: "priority_call_ready",
        leadId: item.leadId,
        queueItemId: item.id,
        phone: item.phoneNumber,
      }),
      metadata: { priorityScore: item.priorityScore },
    })
  }
}
