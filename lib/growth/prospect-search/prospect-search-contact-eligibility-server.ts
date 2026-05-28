import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { loadProspectSearchSuppressionLookup } from "@/lib/growth/prospect-search/prospect-search-suppression-overlays"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"

export type ProspectSearchContactEligibilityHints = {
  phone_on_dnc: boolean | null
  email_suppressed: boolean
  contact_suppressed: boolean
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || null
}

export async function loadPhoneDncLookup(
  admin: SupabaseClient,
  phones: string[],
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>()
  const orgId = getGrowthEngineAiOrgId()
  if (!orgId || phones.length === 0) return map

  const normalized = [
    ...new Set(
      phones
        .map((phone) => normalizePhoneNumber(phone) || phone.replace(/\D/g, ""))
        .filter(Boolean),
    ),
  ].slice(0, 100)

  if (normalized.length === 0) return map

  try {
    const { data, error } = await admin
      .schema("voice")
      .from("voice_dnc_entries")
      .select("phone_number")
      .eq("organization_id", orgId)
      .in("phone_number", normalized)

    if (error) return map
    for (const row of data ?? []) {
      const phone = typeof (row as { phone_number?: unknown }).phone_number === "string"
        ? (row as { phone_number: string }).phone_number
        : ""
      if (phone) map.set(phone, true)
    }
  } catch {
    return map
  }

  return map
}

export async function resolveProspectSearchContactEligibilityHints(
  admin: SupabaseClient,
  input: {
    email?: string | null
    phone?: string | null
    company_name?: string | null
    website?: string | null
    growth_lead_id?: string | null
    company_suppressed?: boolean
  },
  context?: {
    suppressionLookup?: Awaited<ReturnType<typeof loadProspectSearchSuppressionLookup>>
    phoneDncLookup?: Map<string, boolean>
  },
): Promise<ProspectSearchContactEligibilityHints> {
  const suppressionLookup =
    context?.suppressionLookup ?? (await loadProspectSearchSuppressionLookup(admin))
  const overlay = suppressionLookup.matchForIdentifiers({
    email: input.email,
    phone: input.phone,
    company_name: input.company_name,
    website: input.website,
    growth_lead_id: input.growth_lead_id,
  })

  const email = normalizeEmail(input.email)
  const emailOverlay = email
    ? suppressionLookup.matchForIdentifiers({ email })
    : null

  const normalizedPhone = input.phone
    ? normalizePhoneNumber(input.phone) || input.phone.replace(/\D/g, "")
    : null
  let phone_on_dnc: boolean | null = null
  if (normalizedPhone) {
    const lookup = context?.phoneDncLookup ?? (await loadPhoneDncLookup(admin, [input.phone!]))
    if (lookup.size === 0 && !getGrowthEngineAiOrgId()) phone_on_dnc = null
    else phone_on_dnc = lookup.has(normalizedPhone)
  }

  return {
    phone_on_dnc,
    email_suppressed: Boolean(emailOverlay?.is_suppressed),
    contact_suppressed: Boolean(input.company_suppressed || overlay?.is_suppressed),
  }
}
