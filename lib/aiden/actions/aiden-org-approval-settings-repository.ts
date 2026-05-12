import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type AidenOrgApprovalSettingsRow = {
  organization_id: string
  allow_financial_aiden_actions: boolean
  require_owner_approval_for_bulk_financial_actions: boolean
  max_bulk_action_count: number | null
  max_financial_action_amount_without_owner_approval: string | number | null
}

export const DEFAULT_AIDEN_ORG_APPROVAL_SETTINGS: Omit<AidenOrgApprovalSettingsRow, "organization_id"> = {
  allow_financial_aiden_actions: true,
  require_owner_approval_for_bulk_financial_actions: false,
  max_bulk_action_count: null,
  max_financial_action_amount_without_owner_approval: null,
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function normalizeAidenOrgApprovalSettings(
  row: Partial<AidenOrgApprovalSettingsRow> | null,
): Omit<AidenOrgApprovalSettingsRow, "organization_id"> {
  if (!row) return { ...DEFAULT_AIDEN_ORG_APPROVAL_SETTINGS }
  return {
    allow_financial_aiden_actions:
      typeof row.allow_financial_aiden_actions === "boolean" ?
        row.allow_financial_aiden_actions
      : DEFAULT_AIDEN_ORG_APPROVAL_SETTINGS.allow_financial_aiden_actions,
    require_owner_approval_for_bulk_financial_actions:
      typeof row.require_owner_approval_for_bulk_financial_actions === "boolean" ?
        row.require_owner_approval_for_bulk_financial_actions
      : DEFAULT_AIDEN_ORG_APPROVAL_SETTINGS.require_owner_approval_for_bulk_financial_actions,
    max_bulk_action_count:
      row.max_bulk_action_count === null || row.max_bulk_action_count === undefined ?
        null
      : typeof row.max_bulk_action_count === "number" && Number.isFinite(row.max_bulk_action_count) ?
        row.max_bulk_action_count
      : DEFAULT_AIDEN_ORG_APPROVAL_SETTINGS.max_bulk_action_count,
    max_financial_action_amount_without_owner_approval:
      row.max_financial_action_amount_without_owner_approval === null ||
      row.max_financial_action_amount_without_owner_approval === undefined ?
        null
      : toNumber(row.max_financial_action_amount_without_owner_approval as string | number),
  }
}

export async function fetchAidenOrgApprovalSettings(
  client: SupabaseClient,
  organizationId: string,
): Promise<{ data: Omit<AidenOrgApprovalSettingsRow, "organization_id"> | null; error: Error | null }> {
  const { data, error } = await client
    .from("aiden_org_approval_settings")
    .select(
      "organization_id, allow_financial_aiden_actions, require_owner_approval_for_bulk_financial_actions, max_bulk_action_count, max_financial_action_amount_without_owner_approval",
    )
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: normalizeAidenOrgApprovalSettings(data as AidenOrgApprovalSettingsRow | null), error: null }
}

export type UpsertAidenOrgApprovalSettingsInput = {
  allow_financial_aiden_actions?: boolean
  require_owner_approval_for_bulk_financial_actions?: boolean
  max_bulk_action_count?: number | null
  max_financial_action_amount_without_owner_approval?: number | null
}

export async function upsertAidenOrgApprovalSettings(
  svc: SupabaseClient,
  organizationId: string,
  patch: UpsertAidenOrgApprovalSettingsInput,
): Promise<{ data: AidenOrgApprovalSettingsRow | null; error: Error | null }> {
  const current = await fetchAidenOrgApprovalSettings(svc, organizationId)
  if (current.error || !current.data) {
    return { data: null, error: current.error ?? new Error("Could not load current approval settings.") }
  }

  const next = {
    organization_id: organizationId,
    allow_financial_aiden_actions:
      typeof patch.allow_financial_aiden_actions === "boolean" ?
        patch.allow_financial_aiden_actions
      : current.data.allow_financial_aiden_actions,
    require_owner_approval_for_bulk_financial_actions:
      typeof patch.require_owner_approval_for_bulk_financial_actions === "boolean" ?
        patch.require_owner_approval_for_bulk_financial_actions
      : current.data.require_owner_approval_for_bulk_financial_actions,
    max_bulk_action_count:
      patch.max_bulk_action_count === undefined ? current.data.max_bulk_action_count : patch.max_bulk_action_count,
    max_financial_action_amount_without_owner_approval:
      patch.max_financial_action_amount_without_owner_approval === undefined ?
        current.data.max_financial_action_amount_without_owner_approval
      : patch.max_financial_action_amount_without_owner_approval,
  }

  const { data, error } = await svc
    .from("aiden_org_approval_settings")
    .upsert(next, { onConflict: "organization_id" })
    .select("*")
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data as AidenOrgApprovalSettingsRow, error: null }
}
