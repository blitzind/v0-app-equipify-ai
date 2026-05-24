import "server-only"

import { mapLemlistApiError } from "@/lib/growth/outbound/providers/lemlist/lemlist-errors"

export const LEMLIST_DEFAULT_API_BASE = "https://api.lemlist.com/api"

export type LemlistCampaignSummary = {
  id: string
  name: string
  status: string | null
}

export type LemlistCampaignStats = {
  sent: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  interested: number
  unsubscribed: number
  meetingBooked: number
}

export type LemlistCreateLeadResult = {
  leadId: string
  contactId: string | null
  campaignId: string
  campaignName: string | null
  isPaused: boolean
}

export type LemlistTeamInfo = {
  teamId: string | null
  teamName: string | null
}

function resolveApiBase(apiBaseUrl: string | null | undefined): string {
  const trimmed = apiBaseUrl?.trim()
  return trimmed ? trimmed.replace(/\/$/, "") : LEMLIST_DEFAULT_API_BASE
}

function buildAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`:${apiKey}`, "utf8").toString("base64")}`
}

async function lemlistFetch<T>(
  input: {
    apiKey: string
    apiBaseUrl?: string | null
    path: string
    method?: "GET" | "POST"
    query?: Record<string, string | undefined>
    body?: unknown
  },
): Promise<T> {
  const base = resolveApiBase(input.apiBaseUrl)
  const url = new URL(`${base}${input.path.startsWith("/") ? input.path : `/${input.path}`}`)
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value != null && value !== "") url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    method: input.method ?? "GET",
    headers: {
      Authorization: buildAuthHeader(input.apiKey),
      Accept: "application/json",
      ...(input.body != null ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body != null ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
  })

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      parsed = text
    }
  }

  if (!response.ok) {
    throw mapLemlistApiError(response.status, parsed)
  }

  return parsed as T
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function readNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0
}

function pickStat(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (key in record) return readNumber(record[key])
  }
  return 0
}

export async function validateLemlistApiKey(input: {
  apiKey: string
  apiBaseUrl?: string | null
}): Promise<LemlistTeamInfo> {
  const data = await lemlistFetch<Record<string, unknown>>({
    apiKey: input.apiKey,
    apiBaseUrl: input.apiBaseUrl,
    path: "/team",
  })
  const record = asRecord(data)
  return {
    teamId: typeof record._id === "string" ? record._id : typeof record.id === "string" ? record.id : null,
    teamName: typeof record.name === "string" ? record.name : null,
  }
}

export async function listLemlistCampaigns(input: {
  apiKey: string
  apiBaseUrl?: string | null
  limit?: number
}): Promise<LemlistCampaignSummary[]> {
  const data = await lemlistFetch<unknown>({
    apiKey: input.apiKey,
    apiBaseUrl: input.apiBaseUrl,
    path: "/campaigns",
    query: {
      version: "v2",
      limit: String(Math.min(input.limit ?? 100, 100)),
    },
  })

  const rows = Array.isArray(data) ? data : Array.isArray(asRecord(data).campaigns) ? (asRecord(data).campaigns as unknown[]) : []
  return rows.flatMap((row) => {
    const record = asRecord(row)
    const id = typeof record._id === "string" ? record._id : typeof record.id === "string" ? record.id : null
    const name = typeof record.name === "string" ? record.name : null
    if (!id || !name) return []
    return [{ id, name, status: typeof record.status === "string" ? record.status : null }]
  })
}

export async function fetchLemlistCampaignStats(input: {
  apiKey: string
  apiBaseUrl?: string | null
  campaignId: string
}): Promise<LemlistCampaignStats> {
  const data = await lemlistFetch<Record<string, unknown>>({
    apiKey: input.apiKey,
    apiBaseUrl: input.apiBaseUrl,
    path: `/v2/campaigns/${encodeURIComponent(input.campaignId)}/stats`,
  })
  const record = asRecord(data)
  return {
    sent: pickStat(record, ["nbLeadsContacted", "nbEmailsSent", "sent", "emailsSent"]),
    opened: pickStat(record, ["nbEmailsOpened", "opened", "emailsOpened"]),
    clicked: pickStat(record, ["nbEmailsClicked", "clicked", "emailsClicked"]),
    replied: pickStat(record, ["nbEmailsReplied", "replied", "emailsReplied"]),
    bounced: pickStat(record, ["nbEmailsBounced", "bounced", "emailsBounced"]),
    interested: pickStat(record, ["nbInterested", "interested"]),
    unsubscribed: pickStat(record, ["nbEmailsUnsubscribed", "unsubscribed", "emailsUnsubscribed"]),
    meetingBooked: pickStat(record, ["nbMeetingBooked", "meetingBooked", "meetingsBooked"]),
  }
}

export async function createLemlistCampaignLead(input: {
  apiKey: string
  apiBaseUrl?: string | null
  campaignId: string
  lead: {
    email: string
    firstName?: string | null
    lastName?: string | null
    companyName?: string | null
    icebreaker?: string | null
  }
  deduplicate?: boolean
}): Promise<LemlistCreateLeadResult> {
  const data = await lemlistFetch<Record<string, unknown>>({
    apiKey: input.apiKey,
    apiBaseUrl: input.apiBaseUrl,
    path: `/campaigns/${encodeURIComponent(input.campaignId)}/leads/`,
    method: "POST",
    query: {
      deduplicate: input.deduplicate ? "true" : "false",
    },
    body: {
      email: input.lead.email,
      firstName: input.lead.firstName ?? undefined,
      lastName: input.lead.lastName ?? undefined,
      companyName: input.lead.companyName ?? undefined,
      icebreaker: input.lead.icebreaker ?? undefined,
    },
  })

  const record = asRecord(data)
  const leadId =
    typeof record._id === "string"
      ? record._id
      : typeof record.leadId === "string"
        ? record.leadId
        : typeof record.id === "string"
          ? record.id
          : null
  if (!leadId) {
    throw new Error("lemlist_lead_create_missing_id")
  }

  return {
    leadId,
    contactId: typeof record.contactId === "string" ? record.contactId : null,
    campaignId: typeof record.campaignId === "string" ? record.campaignId : input.campaignId,
    campaignName: typeof record.campaignName === "string" ? record.campaignName : null,
    isPaused: record.isPaused === true,
  }
}
