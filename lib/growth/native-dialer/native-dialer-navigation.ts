/** Client-safe navigation helpers for native call workspace. */

import { growthWorkspaceCallWorkspaceHref } from "@/lib/growth/navigation/growth-call-notification-links"

export function nativeCallWorkspaceHref(input?: {
  leadId?: string | null
  phone?: string | null
  queueItemId?: string | null
  dialMode?: string | null
}): string {
  return growthWorkspaceCallWorkspaceHref(input)
}
