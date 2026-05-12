import type { AidenWorkOrderReference } from "@/lib/aiden/intent/intent-types"

/**
 * Detect work-order scope phrases in **normalized** (lower-case, collapsed-space) text.
 * Returns null when no recognizable work-order reference is present.
 */
export function parseWorkOrderReferenceFromNormalizedText(normalized: string): AidenWorkOrderReference | null {
  if (/\bthis\s+work\s+order\b/.test(normalized) || /\bthis\s+wo\b/.test(normalized)) {
    return null
  }

  if (
    /\b(latest|last|most\s+recent)\s+completed\s+(work\s+order|job)\b/.test(normalized) ||
    /\bcompleted\s+(work\s+order|job)\b.*\b(latest|last|most\s+recent)\b/.test(normalized) ||
    /\b(from|using)\s+the\s+latest\s+completed\s+(work\s+order|job)\b/.test(normalized)
  ) {
    return "latest_completed"
  }

  if (
    /\b(my|their)\s+last\s+(work\s+order|job)\b/.test(normalized) ||
    /\b(last|latest|most\s+recent)\s+(work\s+order|job)\b/.test(normalized) ||
    /\b(from|based\s+on)\s+(my|their)\s+last\s+(work\s+order|job)\b/.test(normalized) ||
    /\b(last|latest)\s+visit\b/.test(normalized) ||
    /\bbased\s+on\s+the\s+last\s+visit\b/.test(normalized) ||
    /\b(from|using)\s+the\s+last\s+visit\b/.test(normalized)
  ) {
    return "latest"
  }

  const woHash = normalized.match(/\bwork\s+order\s*#?\s*([a-z0-9-]{4,})\b/i)
  if (woHash?.[1]) return woHash[1].trim()

  const woNum = normalized.match(/\bwork\s+order\s+(\d+)\b/)
  if (woNum?.[1]) return woNum[1]

  const woShort = normalized.match(/\bwo\s*#?\s*([a-z0-9-]{2,})\b/i)
  if (woShort?.[1]) return woShort[1].trim()

  return null
}

/**
 * True when phrase explicitly anchors to the open / UI work order ("this work order"), not a ranked "latest".
 */
export function normalizedTextRequestsThisWorkOrder(normalized: string): boolean {
  if (/\bthis\s+work\s+order\b/.test(normalized) || /\bthis\s+wo\b/.test(normalized)) return true
  if (/\bthis\s+job\b/.test(normalized)) return true
  // "make invoice from this" / "invoice from this" on the work order page
  if (/\binvoice\b/.test(normalized) && /\bfrom\s+this\b/.test(normalized)) return true
  if (/\b(make|create|draft)\b/.test(normalized) && /\binvoice\b/.test(normalized) && /\bfrom\s+this\b/.test(normalized)) {
    return true
  }
  return false
}
