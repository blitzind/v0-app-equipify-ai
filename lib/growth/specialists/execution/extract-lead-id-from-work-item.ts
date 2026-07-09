/** GE-AIOS-18A — Extract lead id from canonical work items (client-safe). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function extractLeadIdFromWorkItem(item: AvaWorkItem): string | null {
  if (item.decision_source_id && UUID_PATTERN.test(item.decision_source_id)) {
    return item.decision_source_id
  }

  const href = item.href ?? ""
  const leadMatch = href.match(/\/leads\/([^/?#]+)/i)
  if (leadMatch?.[1] && UUID_PATTERN.test(leadMatch[1])) {
    return leadMatch[1]
  }

  return null
}
