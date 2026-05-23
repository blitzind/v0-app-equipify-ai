import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOutboundContact, GrowthOutboundContactStatus } from "@/lib/growth/outbound/types"

type ContactDbRow = {
  id: string
  connection_id: string
  campaign_id: string | null
  lead_id: string | null
  decision_maker_id: string | null
  email: string
  provider_contact_id: string | null
  enrollment_status: string
  first_contacted_at: string | null
  last_event_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, connection_id, campaign_id, lead_id, decision_maker_id, email, provider_contact_id, enrollment_status, first_contacted_at, last_event_at, metadata, created_at, updated_at"

function contactsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outbound_contacts")
}

function mapRow(row: ContactDbRow): GrowthOutboundContact {
  return {
    id: row.id,
    connectionId: row.connection_id,
    campaignId: row.campaign_id,
    leadId: row.lead_id,
    decisionMakerId: row.decision_maker_id,
    email: row.email,
    providerContactId: row.provider_contact_id,
    enrollmentStatus: row.enrollment_status as GrowthOutboundContactStatus,
    firstContactedAt: row.first_contacted_at,
    lastEventAt: row.last_event_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertGrowthOutboundContact(
  admin: SupabaseClient,
  input: {
    connectionId: string
    campaignId?: string | null
    leadId: string
    decisionMakerId?: string | null
    email: string
    providerContactId?: string | null
    enrollmentStatus?: GrowthOutboundContactStatus
    lastEventAt?: string
    firstContactedAt?: string
  },
): Promise<GrowthOutboundContact> {
  if (input.providerContactId) {
    const { data: existing } = await contactsTable(admin)
      .select(SELECT)
      .eq("connection_id", input.connectionId)
      .eq("provider_contact_id", input.providerContactId)
      .maybeSingle()
    if (existing) {
      const { data, error } = await contactsTable(admin)
        .update({
          lead_id: input.leadId,
          decision_maker_id: input.decisionMakerId ?? existing.decision_maker_id,
          campaign_id: input.campaignId ?? existing.campaign_id,
          email: input.email,
          last_event_at: input.lastEventAt ?? existing.last_event_at,
          first_contacted_at: existing.first_contacted_at ?? input.firstContactedAt ?? null,
          enrollment_status: input.enrollmentStatus ?? existing.enrollment_status,
        })
        .eq("id", existing.id)
        .select(SELECT)
        .single()
      if (error) throw new Error(error.message)
      return mapRow(data as ContactDbRow)
    }
  }

  const { data, error } = await contactsTable(admin)
    .insert({
      connection_id: input.connectionId,
      campaign_id: input.campaignId ?? null,
      lead_id: input.leadId,
      decision_maker_id: input.decisionMakerId ?? null,
      email: input.email,
      provider_contact_id: input.providerContactId ?? null,
      enrollment_status: input.enrollmentStatus ?? "active",
      first_contacted_at: input.firstContactedAt ?? null,
      last_event_at: input.lastEventAt ?? null,
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ContactDbRow)
}

export async function listGrowthOutboundContactsForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthOutboundContact[]> {
  const { data, error } = await contactsTable(admin)
    .select(SELECT)
    .eq("lead_id", leadId)
    .order("last_event_at", { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ContactDbRow[]).map(mapRow)
}

export async function setGrowthOutboundContactSuppressed(
  admin: SupabaseClient,
  contactId: string,
): Promise<void> {
  const { error } = await contactsTable(admin)
    .update({ enrollment_status: "suppressed" })
    .eq("id", contactId)
  if (error) throw new Error(error.message)
}
