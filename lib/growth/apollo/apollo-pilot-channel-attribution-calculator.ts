/** Apollo pilot channel attribution — client-safe. */

import {
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotChannelAttributionMetrics,
  type ApolloPilotChannelAttributionRow,
} from "@/lib/growth/apollo/apollo-pilot-types"

export type ApolloPilotAttributionEvent = {
  channel: string
  event_type: "reply" | "meeting" | "opportunity"
  first_touch_channel?: string | null
  last_touch_channel?: string | null
  assisting_channels?: string[]
}

const CHANNEL_ORDER = ["email", "sms", "voice_drop", "call", "multi_touch"] as const

function normalizeChannel(channel: string): string {
  const lower = channel.trim().toLowerCase()
  if (lower === "voice_drop" || lower === "voicemail") return "voice_drop"
  if (lower === "multi-channel" || lower === "multichannel") return "multi_touch"
  return lower
}

export function buildApolloPilotChannelAttributionMetrics(input: {
  cohort_id: string
  events: ApolloPilotAttributionEvent[]
  computed_at?: string
}): ApolloPilotChannelAttributionMetrics {
  const bucket = new Map<string, ApolloPilotChannelAttributionRow>()

  for (const channel of CHANNEL_ORDER) {
    bucket.set(channel, {
      channel,
      first_touch_meetings: 0,
      last_touch_meetings: 0,
      assisting_meetings: 0,
      replies: 0,
      opportunities: 0,
    })
  }

  for (const event of input.events) {
    const channel = normalizeChannel(event.channel)
    const row = bucket.get(channel) ?? {
      channel,
      first_touch_meetings: 0,
      last_touch_meetings: 0,
      assisting_meetings: 0,
      replies: 0,
      opportunities: 0,
    }

    if (event.event_type === "reply") row.replies += 1
    if (event.event_type === "opportunity") row.opportunities += 1
    if (event.event_type === "meeting") {
      const first = normalizeChannel(event.first_touch_channel ?? event.channel)
      const last = normalizeChannel(event.last_touch_channel ?? event.channel)
      const firstRow = bucket.get(first) ?? row
      firstRow.first_touch_meetings += 1
      bucket.set(first, firstRow)
      const lastRow = bucket.get(last) ?? row
      lastRow.last_touch_meetings += 1
      bucket.set(last, lastRow)
      for (const assist of event.assisting_channels ?? []) {
        const assistKey = normalizeChannel(assist)
        const assistRow = bucket.get(assistKey) ?? {
          channel: assistKey,
          first_touch_meetings: 0,
          last_touch_meetings: 0,
          assisting_meetings: 0,
          replies: 0,
          opportunities: 0,
        }
        assistRow.assisting_meetings += 1
        bucket.set(assistKey, assistRow)
      }
    }
    bucket.set(channel, row)
  }

  const channels = [...bucket.values()].filter(
    (row) =>
      row.first_touch_meetings > 0 ||
      row.last_touch_meetings > 0 ||
      row.assisting_meetings > 0 ||
      row.replies > 0 ||
      row.opportunities > 0,
  )

  const top_meeting_channel =
    channels.sort((a, b) => b.last_touch_meetings - a.last_touch_meetings)[0]?.channel ?? null

  return {
    qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
    cohort_id: input.cohort_id,
    channels,
    top_meeting_channel,
    computed_at: input.computed_at ?? new Date().toISOString(),
  }
}
