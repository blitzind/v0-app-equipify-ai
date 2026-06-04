import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertPersonCompanyRoleForDiscovery } from "@/lib/growth/email-discovery/email-discovery-preflight"
import type { GrowthSocialProfileDiscoveryScope } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export class SocialProfileDiscoveryPreflightError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_company_person_role"
      | "missing_person_for_scope"
      | "unexpected_person_for_company_scope",
  ) {
    super(message)
    this.name = "SocialProfileDiscoveryPreflightError"
  }
}

export { assertPersonCompanyRoleForDiscovery }

export async function assertSocialProfileDiscoveryPreflight(
  admin: SupabaseClient,
  input: {
    company_id: string
    person_id: string | null | undefined
    discovery_scope: GrowthSocialProfileDiscoveryScope
  },
): Promise<void> {
  const company_id = input.company_id.trim()
  if (!company_id) {
    throw new SocialProfileDiscoveryPreflightError("company_id is required.", "missing_person_for_scope")
  }

  const { data: company } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("id", company_id)
    .maybeSingle()
  if (!company) {
    throw new SocialProfileDiscoveryPreflightError("Canonical company not found.", "missing_person_for_scope")
  }

  if (input.discovery_scope === "company") {
    if (input.person_id) {
      throw new SocialProfileDiscoveryPreflightError(
        "Company-scoped discovery must not include person_id.",
        "unexpected_person_for_company_scope",
      )
    }
    return
  }

  const person_id = typeof input.person_id === "string" ? input.person_id.trim() : ""
  if (!person_id) {
    throw new SocialProfileDiscoveryPreflightError(
      "Person-scoped discovery requires person_id.",
      "missing_person_for_scope",
    )
  }

  await assertPersonCompanyRoleForDiscovery(admin, { company_id, person_id })
}
