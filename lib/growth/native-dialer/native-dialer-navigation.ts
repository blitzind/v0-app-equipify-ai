/** Client-safe navigation helpers for native call workspace. */

export function nativeCallWorkspaceHref(input?: {
  leadId?: string | null
  phone?: string | null
  queueItemId?: string | null
  dialMode?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.phone) params.set("phone", input.phone)
  if (input?.queueItemId) params.set("queueItemId", input.queueItemId)
  if (input?.dialMode) params.set("dialMode", input.dialMode)
  const query = params.toString()
  return query ? `/admin/growth/calls/workspace?${query}` : "/admin/growth/calls/workspace"
}
