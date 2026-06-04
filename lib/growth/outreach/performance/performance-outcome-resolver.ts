/** Attach outcome flags to attributed sends (Phase 4.6). Client-safe. */

import type {
  OutreachPerformanceAttributedSend,
  OutreachPerformanceAttributionRecord,
  OutreachPerformanceOutcomeFlags,
} from "@/lib/growth/outreach/performance/performance-types"

export function attachOutreachPerformanceOutcomes(
  attribution: OutreachPerformanceAttributionRecord,
  outcomes: OutreachPerformanceOutcomeFlags & { sentAt?: string | null },
): OutreachPerformanceAttributedSend {
  return {
    ...attribution,
    sent: outcomes.sent,
    replied: outcomes.replied,
    positiveInterest: outcomes.positiveInterest,
    meetingBooked: outcomes.meetingBooked,
    opportunityCreated: outcomes.opportunityCreated,
    sentAt: outcomes.sentAt ?? null,
  }
}
