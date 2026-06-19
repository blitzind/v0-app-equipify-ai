import type { NativeDialerQueueItemPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { QueuePreviewState } from "@/lib/growth/native-dialer/call-workspace-operator-types"

export function queueItemToPreviewState(item: NativeDialerQueueItemPublicView): QueuePreviewState {
  return {
    queueItemId: item.id,
    leadId: item.leadId,
    company: item.companyName ?? undefined,
    contact: item.contactName ?? undefined,
    phone: item.phoneNumber ?? undefined,
    queueMode: item.queueMode,
    reason: item.reason,
  }
}

export function previewStateFromPartial(input: QueuePreviewState | null | undefined): QueuePreviewState | null {
  if (!input?.leadId && !input?.phone) return null
  return input
}
