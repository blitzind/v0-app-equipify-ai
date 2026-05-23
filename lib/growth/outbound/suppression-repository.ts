import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeEmail } from "@/lib/growth/import/normalize"
import type { GrowthSuppressionEntry, GrowthSuppressionReason, GrowthSuppressionSource } from "@/lib/growth/outbound/types"

type SuppressionDbRow = {
  id: string
  email: string
  reason: string
  source: string
  lead_id: string | null
  contact_id: string | null
  message_event_id: string | null
  notes: string | null
  suppressed_at: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, email, reason, source, lead_id, contact_id, message_event_id, notes, suppressed_at, expires_at, created_at, updated_at"

function suppressionTable(admin: SupabaseClient) {
  return admin.schema("growth").from("suppression_entries")
}

function mapRow(row: SuppressionDbRow): GrowthSuppressionEntry {
  return {
    id: row.id,
    email: row.email,
    reason: row.reason as GrowthSuppressionReason,
    source: row.source as GrowthSuppressionSource,
    leadId: row.lead_id,
    contactId: row.contact_id,
    messageEventId: row.message_event_id,
    notes: row.notes,
    suppressedAt: row.suppressed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function isEmailSuppressed(admin: SupabaseClient, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  const { data, error } = await suppressionTable(admin).select("id").eq("email", normalized).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function upsertGrowthSuppressionEntry(
  admin: SupabaseClient,
  input: {
    email: string
    reason: GrowthSuppressionReason
    source: GrowthSuppressionSource
    leadId?: string | null
    contactId?: string | null
    messageEventId?: string | null
    notes?: string | null
  },
): Promise<GrowthSuppressionEntry> {
  const normalized = normalizeEmail(input.email)
  if (!normalized) throw new Error("invalid_email")

  const { data: existing } = await suppressionTable(admin).select(SELECT).eq("email", normalized).maybeSingle()
  if (existing) return mapRow(existing as SuppressionDbRow)

  const { data, error } = await suppressionTable(admin)
    .insert({
      email: normalized,
      reason: input.reason,
      source: input.source,
      lead_id: input.leadId ?? null,
      contact_id: input.contactId ?? null,
      message_event_id: input.messageEventId ?? null,
      notes: input.notes ?? null,
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as SuppressionDbRow)
}

export async function listGrowthSuppressionEntries(
  admin: SupabaseClient,
  limit = 100,
): Promise<GrowthSuppressionEntry[]> {
  const { data, error } = await suppressionTable(admin)
    .select(SELECT)
    .order("suppressed_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as SuppressionDbRow[]).map(mapRow)
}

export async function assertEmailSendAllowed(
  admin: SupabaseClient,
  email: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const suppressed = await isEmailSuppressed(admin, email)
  if (suppressed) return { allowed: false, reason: "suppressed" }
  return { allowed: true }
}
