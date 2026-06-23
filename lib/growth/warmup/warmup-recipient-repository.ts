import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  type GrowthWarmupRecipient,
  type GrowthWarmupRecipientType,
} from "@/lib/growth/warmup/warmup-executor-types"

function recipientsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("warmup_recipients")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mapRecipient(row: Record<string, unknown>): GrowthWarmupRecipient {
  return {
    id: asString(row.id),
    email: asString(row.email),
    name: asString(row.name),
    label: asString(row.label),
    recipient_type: asString(row.recipient_type) as GrowthWarmupRecipientType,
    active: Boolean(row.active),
    approved: Boolean(row.approved),
    max_emails_per_day: Number(row.max_emails_per_day ?? 0),
    max_emails_per_week: Number(row.max_emails_per_week ?? 0),
    last_sent_at: asString(row.last_sent_at) || null,
    notes: asString(row.notes) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

export async function listWarmupRecipients(
  admin: SupabaseClient,
  input?: { activeOnly?: boolean; approvedOnly?: boolean },
): Promise<GrowthWarmupRecipient[]> {
  let query = recipientsTable(admin)
    .select("*")
    .is("deleted_at", null)
    .order("email", { ascending: true })

  if (input?.activeOnly) query = query.eq("active", true)
  if (input?.approvedOnly) query = query.eq("approved", true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRecipient(row as Record<string, unknown>))
}

export async function getWarmupRecipientById(
  admin: SupabaseClient,
  id: string,
): Promise<GrowthWarmupRecipient | null> {
  const { data, error } = await recipientsTable(admin)
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRecipient(data as Record<string, unknown>) : null
}

export async function insertWarmupRecipient(
  admin: SupabaseClient,
  input: {
    email: string
    name?: string
    label?: string
    recipient_type?: GrowthWarmupRecipientType
    active?: boolean
    approved?: boolean
    max_emails_per_day?: number
    max_emails_per_week?: number
    notes?: string | null
  },
): Promise<GrowthWarmupRecipient> {
  const now = new Date().toISOString()
  const { data, error } = await recipientsTable(admin)
    .insert({
      email: input.email.trim().toLowerCase(),
      name: input.name?.trim() ?? "",
      label: input.label?.trim() ?? "",
      recipient_type: input.recipient_type ?? "safe_contact",
      active: input.active ?? true,
      approved: input.approved ?? false,
      max_emails_per_day: input.max_emails_per_day ?? 3,
      max_emails_per_week: input.max_emails_per_week ?? 10,
      notes: input.notes ?? null,
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRecipient(data as Record<string, unknown>)
}

export async function updateWarmupRecipient(
  admin: SupabaseClient,
  id: string,
  patch: Partial<{
    email: string
    name: string
    label: string
    recipient_type: GrowthWarmupRecipientType
    active: boolean
    approved: boolean
    max_emails_per_day: number
    max_emails_per_week: number
    notes: string | null
    last_sent_at: string
  }>,
): Promise<GrowthWarmupRecipient> {
  const { data, error } = await recipientsTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRecipient(data as Record<string, unknown>)
}

export async function softDeleteWarmupRecipient(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await recipientsTable(admin)
    .update({ deleted_at: new Date().toISOString(), active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function countRecipientSendsSince(
  admin: SupabaseClient,
  recipientId: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("warmup_send_attempts")
    .select("id", { count: "exact", head: true })
    .eq("warmup_recipient_id", recipientId)
    .eq("status", "sent")
    .gte("created_at", sinceIso)
  if (error?.message?.includes("does not exist")) return 0
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function countExecutorSendsForProfileToday(
  admin: SupabaseClient,
  profileId: string,
  dayStartIso: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("warmup_send_attempts")
    .select("id", { count: "exact", head: true })
    .eq("warmup_profile_id", profileId)
    .eq("status", "sent")
    .gte("created_at", dayStartIso)
  if (error?.message?.includes("does not exist")) return 0
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function listWarmupRecipientEmailsForProfileSince(
  admin: SupabaseClient,
  profileId: string,
  sinceIso: string,
): Promise<string[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("warmup_send_attempts")
    .select("recipient_email")
    .eq("warmup_profile_id", profileId)
    .eq("status", "sent")
    .gte("created_at", sinceIso)
  if (error?.message?.includes("does not exist")) return []
  if (error) throw new Error(error.message)
  const emails = new Set<string>()
  for (const row of data ?? []) {
    const email = asString((row as Record<string, unknown>).recipient_email).toLowerCase()
    if (email) emails.add(email)
  }
  return [...emails]
}

export async function getLatestWarmupSendRun(
  admin: SupabaseClient,
): Promise<{ id: string; finished_at: string | null; started_at: string } | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("warmup_send_runs")
    .select("id, finished_at, started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error?.message?.includes("does not exist")) return null
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: asString((data as Record<string, unknown>).id),
    finished_at: asString((data as Record<string, unknown>).finished_at) || null,
    started_at: asString((data as Record<string, unknown>).started_at),
  }
}
