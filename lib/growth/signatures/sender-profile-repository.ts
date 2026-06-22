import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SIGNATURE_TEMPLATES,
  type GrowthSenderProfile,
  type GrowthSignatureTemplateId,
} from "@/lib/growth/signatures/signature-types"

type ProfileRow = Record<string, unknown>

function profilesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_profiles")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  return fallback
}

function mapProfile(row: ProfileRow): GrowthSenderProfile {
  const templateRaw = asString(row.signature_template).toLowerCase()
  const signature_template: GrowthSignatureTemplateId = GROWTH_SIGNATURE_TEMPLATES.includes(
    templateRaw as GrowthSignatureTemplateId,
  )
    ? (templateRaw as GrowthSignatureTemplateId)
    : "simple"

  return {
    id: asString(row.id),
    sender_account_id: asString(row.sender_account_id),
    mailbox_connection_id: asString(row.mailbox_connection_id) || null,
    display_name: asString(row.display_name),
    title: asString(row.title) || null,
    email: asString(row.email),
    phone: asString(row.phone) || null,
    website: asString(row.website) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    avatar_url: asString(row.avatar_url) || null,
    logo_url: asString(row.logo_url) || null,
    active: asBool(row.active, true),
    signature_template,
    notes: asString(row.notes) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    deleted_at: asString(row.deleted_at) || null,
  }
}

function activeProfilesQuery(admin: SupabaseClient) {
  return profilesTable(admin).select("*").is("deleted_at", null)
}

export async function listSenderProfiles(admin: SupabaseClient): Promise<GrowthSenderProfile[]> {
  const { data, error } = await activeProfilesQuery(admin).order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapProfile(row as ProfileRow))
}

export async function getSenderProfile(
  admin: SupabaseClient,
  profileId: string,
): Promise<GrowthSenderProfile | null> {
  const { data, error } = await activeProfilesQuery(admin).eq("id", profileId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProfile(data as ProfileRow)
}

export async function getSenderProfileBySenderAccountId(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthSenderProfile | null> {
  const { data, error } = await activeProfilesQuery(admin)
    .eq("sender_account_id", senderAccountId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProfile(data as ProfileRow)
}

export async function getSenderProfileByMailboxConnectionId(
  admin: SupabaseClient,
  mailboxConnectionId: string,
): Promise<GrowthSenderProfile | null> {
  const mailboxId = mailboxConnectionId.trim()
  if (!mailboxId) return null

  const { data, error } = await activeProfilesQuery(admin)
    .eq("mailbox_connection_id", mailboxId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProfile(data as ProfileRow)
}

export async function createSenderProfile(
  admin: SupabaseClient,
  input: {
    sender_account_id: string
    mailbox_connection_id?: string | null
    display_name: string
    title?: string | null
    email: string
    phone?: string | null
    website?: string | null
    linkedin_url?: string | null
    avatar_url?: string | null
    logo_url?: string | null
    active?: boolean
    signature_template?: GrowthSignatureTemplateId
    notes?: string | null
  },
): Promise<GrowthSenderProfile> {
  const senderId = input.sender_account_id.trim()
  const existing = await getSenderProfileBySenderAccountId(admin, senderId)
  if (existing) throw new Error("sender_profile_already_exists")

  const now = new Date().toISOString()
  const { data, error } = await profilesTable(admin)
    .insert({
      sender_account_id: senderId,
      mailbox_connection_id: input.mailbox_connection_id?.trim() || null,
      display_name: input.display_name.trim(),
      title: input.title?.trim() || null,
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      avatar_url: input.avatar_url?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      active: input.active ?? true,
      signature_template: input.signature_template ?? "simple",
      notes: input.notes?.trim() || null,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapProfile(data as ProfileRow)
}

export async function updateSenderProfile(
  admin: SupabaseClient,
  profileId: string,
  patch: Partial<{
    mailbox_connection_id: string | null
    sender_account_id: string
    display_name: string
    title: string | null
    email: string
    phone: string | null
    website: string | null
    linkedin_url: string | null
    avatar_url: string | null
    logo_url: string | null
    active: boolean
    signature_template: GrowthSignatureTemplateId
    notes: string | null
  }>,
): Promise<GrowthSenderProfile> {
  const existing = await getSenderProfile(admin, profileId)
  if (!existing) throw new Error("sender_profile_not_found")

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (patch.mailbox_connection_id !== undefined) {
    updates.mailbox_connection_id = patch.mailbox_connection_id?.trim() || null
  }
  if (patch.sender_account_id !== undefined) {
    const nextSender = patch.sender_account_id.trim()
    if (nextSender !== existing.sender_account_id) {
      const conflict = await getSenderProfileBySenderAccountId(admin, nextSender)
      if (conflict && conflict.id !== profileId) throw new Error("sender_profile_sender_conflict")
      updates.sender_account_id = nextSender
    }
  }
  if (patch.display_name !== undefined) updates.display_name = patch.display_name.trim()
  if (patch.title !== undefined) updates.title = patch.title?.trim() || null
  if (patch.email !== undefined) updates.email = patch.email.trim()
  if (patch.phone !== undefined) updates.phone = patch.phone?.trim() || null
  if (patch.website !== undefined) updates.website = patch.website?.trim() || null
  if (patch.linkedin_url !== undefined) updates.linkedin_url = patch.linkedin_url?.trim() || null
  if (patch.avatar_url !== undefined) updates.avatar_url = patch.avatar_url?.trim() || null
  if (patch.logo_url !== undefined) updates.logo_url = patch.logo_url?.trim() || null
  if (patch.active !== undefined) updates.active = patch.active
  if (patch.signature_template !== undefined) updates.signature_template = patch.signature_template
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() || null

  const { data, error } = await profilesTable(admin)
    .update(updates)
    .is("deleted_at", null)
    .eq("id", profileId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapProfile(data as ProfileRow)
}

export async function assignSenderProfileMailbox(
  admin: SupabaseClient,
  profileId: string,
  mailboxConnectionId: string | null,
): Promise<GrowthSenderProfile> {
  return updateSenderProfile(admin, profileId, { mailbox_connection_id: mailboxConnectionId })
}

export async function softDeleteSenderProfile(
  admin: SupabaseClient,
  profileId: string,
): Promise<{ id: string }> {
  const existing = await getSenderProfile(admin, profileId)
  if (!existing) throw new Error("sender_profile_not_found")

  const deletedAt = new Date().toISOString()
  const { error } = await profilesTable(admin)
    .update({ deleted_at: deletedAt, active: false, updated_at: deletedAt })
    .is("deleted_at", null)
    .eq("id", profileId)

  if (error) throw new Error(error.message)
  return { id: profileId }
}
