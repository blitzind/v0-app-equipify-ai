/** Client-safe call count cache math from disposition rows. */

export type GrowthLeadCallCountCache = {
  callAttemptCount: number
  voicemailCount: number
  connectedCallCount: number
}

const ATTEMPT_DISPOSITIONS = [
  "call_attempted",
  "left_voicemail",
  "interested",
  "no_answer",
  "follow_up_later",
] as const

const CONNECTED_DISPOSITIONS = ["call_attempted", "interested"] as const

export function computeGrowthLeadCallCountsFromRows(
  rows: Array<{ disposition: string }>,
): GrowthLeadCallCountCache {
  let callAttemptCount = 0
  let voicemailCount = 0
  let connectedCallCount = 0

  for (const row of rows) {
    if ((ATTEMPT_DISPOSITIONS as readonly string[]).includes(row.disposition)) {
      callAttemptCount += 1
    }
    if (row.disposition === "left_voicemail") {
      voicemailCount += 1
    }
    if ((CONNECTED_DISPOSITIONS as readonly string[]).includes(row.disposition)) {
      connectedCallCount += 1
    }
  }

  return { callAttemptCount, voicemailCount, connectedCallCount }
}
