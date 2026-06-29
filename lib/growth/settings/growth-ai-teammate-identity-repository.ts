import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GE_AI_UX_3B_QA_MARKER } from "@/lib/growth/settings/growth-ai-teammate-identity-types"
import {
  GROWTH_OPERATOR_WORKSPACE_AI_TEAMMATE_ONBOARDING_COLUMN,
  isGrowthOperatorWorkspaceMissingColumnError,
  isGrowthOrganizationAiTeammateIdentityTableMissingError,
} from "@/lib/growth/settings/growth-workspace-settings-column-compat"

const ORG_SELECT =
  "organization_id, teammate_name, updated_by_user_id, qa_marker, created_at, updated_at"

type OrgIdentityRow = {
  organization_id: string
  teammate_name: string
  updated_by_user_id: string | null
  qa_marker: string
  created_at: string
  updated_at: string
}

export type OrganizationAiTeammateIdentityRecord = {
  organizationId: string
  teammateName: string
  updatedByUserId: string | null
  qaMarker: string
  createdAt: string
  updatedAt: string
}

function orgIdentityTable(admin: SupabaseClient) {
  return admin.schema("growth").from("organization_ai_teammate_identity")
}

function mapOrgRow(row: OrgIdentityRow): OrganizationAiTeammateIdentityRecord {
  return {
    organizationId: row.organization_id,
    teammateName: row.teammate_name,
    updatedByUserId: row.updated_by_user_id,
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getOrganizationAiTeammateIdentity(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationAiTeammateIdentityRecord | null> {
  const { data, error } = await orgIdentityTable(admin)
    .select(ORG_SELECT)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    if (isGrowthOrganizationAiTeammateIdentityTableMissingError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapOrgRow(data as OrgIdentityRow)
}

export async function upsertOrganizationAiTeammateIdentity(
  admin: SupabaseClient,
  input: {
    organizationId: string
    teammateName: string
    updatedByUserId: string
  },
): Promise<OrganizationAiTeammateIdentityRecord> {
  const { data, error } = await orgIdentityTable(admin)
    .upsert(
      {
        organization_id: input.organizationId,
        teammate_name: input.teammateName,
        updated_by_user_id: input.updatedByUserId,
        qa_marker: GE_AI_UX_3B_QA_MARKER,
      },
      { onConflict: "organization_id" },
    )
    .select(ORG_SELECT)
    .single()

  if (error) {
    if (isGrowthOrganizationAiTeammateIdentityTableMissingError(error)) {
      throw new Error(
        "AI teammate identity table is not ready. Apply migration 20270630120000_growth_operator_workspace_ai_teammate_onboarding_prod_hotfix.sql.",
      )
    }
    throw new Error(error.message)
  }
  return mapOrgRow(data as OrgIdentityRow)
}

export async function getAiTeammateOnboardingCompletedForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .schema("growth")
    .from("operator_workspace_preferences")
    .select(GROWTH_OPERATOR_WORKSPACE_AI_TEAMMATE_ONBOARDING_COLUMN)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isGrowthOperatorWorkspaceMissingColumnError(error)) return false
    throw new Error(error.message)
  }
  return Boolean(data?.ai_teammate_onboarding_completed)
}
