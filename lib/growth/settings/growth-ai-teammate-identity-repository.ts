import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getPlatformOrganizationPersonaAutonomousActivation,
  getPlatformOrganizationPersonaRecord,
  getPlatformPersonaOnboardingCompletedForUser,
  isPlatformPersonaOrganizationTableMissingError,
  setPlatformOrganizationPersonaAutonomousActivation,
  upsertPlatformOrganizationPersonaRecord,
  type PlatformOrganizationPersonaRecord,
} from "@fuzor/identity"

export type OrganizationAiTeammateIdentityRecord = PlatformOrganizationPersonaRecord

export { isPlatformPersonaOrganizationTableMissingError as isGrowthOrganizationAiTeammateIdentityTableMissingError }

export async function getOrganizationAiTeammateIdentity(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationAiTeammateIdentityRecord | null> {
  return getPlatformOrganizationPersonaRecord(admin, organizationId)
}

export async function upsertOrganizationAiTeammateIdentity(
  admin: SupabaseClient,
  input: {
    organizationId: string
    teammateName: string
    updatedByUserId: string
  },
): Promise<OrganizationAiTeammateIdentityRecord> {
  return upsertPlatformOrganizationPersonaRecord(admin, input)
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
