import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getPlatformOrganizationPersonaAutonomousActivation,
  getPlatformOrganizationPersonaRecord,
  getPlatformPersonaOnboardingCompletedForUser,
  isPlatformPersonaOrganizationTableMissingError,
  PLATFORM_PERSONA_DEFAULT_NAME,
  PLATFORM_PERSONA_DEFAULT_ROLE,
  sanitizePlatformPersonaName,
  setPlatformOrganizationPersonaAutonomousActivation,
  upsertPlatformOrganizationPersonaRecord,
  type PlatformOrganizationPersonaRecord,
} from "@fuzor/identity"

import type { AiTeammateIdentity } from "@/lib/growth/settings/growth-ai-teammate-identity-types"
import {
  isGrowthOrganizationAiTeammateActivationColumnMissingError,
  isGrowthOrganizationAiTeammateIdentityTableMissingError,
} from "@/lib/growth/settings/growth-workspace-settings-column-compat"

export type OrganizationAiTeammateIdentityRecord = PlatformOrganizationPersonaRecord

export { isPlatformPersonaOrganizationTableMissingError as isGrowthOrganizationAiTeammateIdentityTableMissingError }

const ORG_SELECT_WITH_ACTIVATION =
  "organization_id, teammate_name, updated_by_user_id, qa_marker, created_at, updated_at, autonomous_activated_at, autonomous_activated_by_user_id"

const ORG_SELECT_BASE =
  "organization_id, teammate_name, updated_by_user_id, qa_marker, created_at, updated_at"

type OrganizationAiTeammateIdentityRow = {
  organization_id: string
  teammate_name: string
  updated_by_user_id: string | null
  qa_marker: string | null
  created_at: string
  updated_at: string
  autonomous_activated_at?: string | null
  autonomous_activated_by_user_id?: string | null
}

function orgIdentityTable(admin: SupabaseClient) {
  return admin.schema("growth").from("organization_ai_teammate_identity")
}

function mapOrgRow(row: OrganizationAiTeammateIdentityRow): OrganizationAiTeammateIdentityRecord {
  return {
    organizationId: row.organization_id,
    teammateName: row.teammate_name,
    updatedByUserId: row.updated_by_user_id,
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    autonomousActivatedAt: row.autonomous_activated_at ?? null,
    autonomousActivatedByUserId: row.autonomous_activated_by_user_id ?? null,
  }
}

let activationColumnsAvailable: boolean | null = null

async function probeOrganizationAiTeammateActivationColumns(admin: SupabaseClient): Promise<boolean> {
  if (activationColumnsAvailable !== null) return activationColumnsAvailable

  const { error } = await orgIdentityTable(admin).select("autonomous_activated_at").limit(0)
  if (!error) {
    activationColumnsAvailable = true
    return true
  }
  if (
    isGrowthOrganizationAiTeammateActivationColumnMissingError(error) ||
    isGrowthOrganizationAiTeammateIdentityTableMissingError(error)
  ) {
    activationColumnsAvailable = false
    return false
  }

  throw new Error(error.message)
}

async function getOrganizationAiTeammateIdentityRecordResilient(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationAiTeammateIdentityRecord | null> {
  const includeActivation = await probeOrganizationAiTeammateActivationColumns(admin)
  const select = includeActivation ? ORG_SELECT_WITH_ACTIVATION : ORG_SELECT_BASE
  const { data, error } = await orgIdentityTable(admin)
    .select(select)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    if (
      isGrowthOrganizationAiTeammateIdentityTableMissingError(error) ||
      isGrowthOrganizationAiTeammateActivationColumnMissingError(error)
    ) {
      activationColumnsAvailable = false
      if (isGrowthOrganizationAiTeammateIdentityTableMissingError(error)) return null

      const retry = await orgIdentityTable(admin)
        .select(ORG_SELECT_BASE)
        .eq("organization_id", organizationId)
        .maybeSingle()
      if (retry.error) {
        if (isGrowthOrganizationAiTeammateIdentityTableMissingError(retry.error)) return null
        throw new Error(retry.error.message)
      }
      return retry.data ? mapOrgRow(retry.data as OrganizationAiTeammateIdentityRow) : null
    }
    throw new Error(error.message)
  }

  return data ? mapOrgRow(data as OrganizationAiTeammateIdentityRow) : null
}

export async function loadGrowthAiTeammateIdentityRecord(
  admin: SupabaseClient,
  input: { organizationId: string | null; userId: string },
): Promise<AiTeammateIdentity> {
  const onboardingCompleted = await getPlatformPersonaOnboardingCompletedForUser(admin, input.userId)

  if (!input.organizationId) {
    return {
      organizationId: null,
      name: PLATFORM_PERSONA_DEFAULT_NAME,
      role: PLATFORM_PERSONA_DEFAULT_ROLE,
      source: "default",
      onboardingCompleted,
    }
  }

  const orgRecord = await getOrganizationAiTeammateIdentityRecordResilient(admin, input.organizationId)
  if (!orgRecord) {
    return {
      organizationId: input.organizationId,
      name: PLATFORM_PERSONA_DEFAULT_NAME,
      role: PLATFORM_PERSONA_DEFAULT_ROLE,
      source: "default",
      onboardingCompleted,
    }
  }

  return {
    organizationId: orgRecord.organizationId,
    name: sanitizePlatformPersonaName(orgRecord.teammateName),
    role: PLATFORM_PERSONA_DEFAULT_ROLE,
    source: "organization",
    onboardingCompleted,
    updatedByUserId: orgRecord.updatedByUserId,
    updatedAt: orgRecord.updatedAt,
  }
}

export async function getOrganizationAiTeammateIdentity(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationAiTeammateIdentityRecord | null> {
  try {
    return await getPlatformOrganizationPersonaRecord(admin, organizationId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      isGrowthOrganizationAiTeammateActivationColumnMissingError({ message }) ||
      isGrowthOrganizationAiTeammateIdentityTableMissingError({ message })
    ) {
      return getOrganizationAiTeammateIdentityRecordResilient(admin, organizationId)
    }
    throw error
  }
}

export async function upsertOrganizationAiTeammateIdentity(
  admin: SupabaseClient,
  input: {
    organizationId: string
    teammateName: string
    updatedByUserId: string
  },
): Promise<OrganizationAiTeammateIdentityRecord> {
  try {
    return await upsertPlatformOrganizationPersonaRecord(admin, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isGrowthOrganizationAiTeammateActivationColumnMissingError({ message })) throw error

    const { data, error: upsertError } = await orgIdentityTable(admin)
      .upsert(
        {
          organization_id: input.organizationId,
          teammate_name: input.teammateName,
          updated_by_user_id: input.updatedByUserId,
          qa_marker: "ge-ai-ux-3b-ai-teammate-server-identity-v1",
        },
        { onConflict: "organization_id" },
      )
      .select(ORG_SELECT_BASE)
      .single()

    if (upsertError) throw new Error(upsertError.message)
    return mapOrgRow(data as OrganizationAiTeammateIdentityRow)
  }
}

export async function getAiTeammateOnboardingCompletedForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return getPlatformPersonaOnboardingCompletedForUser(admin, userId)
}

export async function getOrganizationAiTeammateAutonomousActivation(
  admin: SupabaseClient,
  organizationId: string,
): Promise<
  Pick<OrganizationAiTeammateIdentityRecord, "autonomousActivatedAt" | "autonomousActivatedByUserId"> | null
> {
  return getPlatformOrganizationPersonaAutonomousActivation(admin, organizationId)
}

export async function setOrganizationAiTeammateAutonomousActivation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    activatedByUserId: string
    activatedAt: string
  },
): Promise<void> {
  return setPlatformOrganizationPersonaAutonomousActivation(admin, input)
}
