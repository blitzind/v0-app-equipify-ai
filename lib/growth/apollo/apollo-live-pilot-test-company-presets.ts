/** Apollo live pilot test company presets — client-safe, no secrets. */

export const APOLLO_LIVE_PILOT_TEST_COMPANY_PRESETS_QA_MARKER =
  "apollo-live-pilot-test-company-presets-v1" as const

export type ApolloLivePilotTestCompanyPreset = {
  profile: string
  company_name: string
  domain: string
  website: string
  industry: string
  coverage_tier: "strong" | "weak"
  notes: string[]
}

export const APOLLO_LIVE_PILOT_TEST_COMPANY_PRESETS: Record<
  string,
  ApolloLivePilotTestCompanyPreset
> = {
  precision_biomedical: {
    profile: "precision_biomedical",
    company_name: "Precision Biomedical Services",
    domain: "precisionbiomedicalservices.com",
    website: "https://precisionbiomedicalservices.com",
    industry: "biomedical_services",
    coverage_tier: "weak",
    notes: [
      "Small local biomedical services company — valid pilot seed but often weak Apollo person coverage.",
      "Useful for mapper/filter diagnostics; not ideal for volume or buying-committee evidence.",
    ],
  },
  henry_schein: {
    profile: "henry_schein",
    company_name: "Henry Schein",
    domain: "henryschein.com",
    website: "https://www.henryschein.com",
    industry: "healthcare_distribution",
    coverage_tier: "strong",
    notes: [
      "Large public B2B healthcare distributor — real domain with likely multi-employee Apollo coverage.",
      "Recommended for stronger live pilot evidence after mapper/filter validation.",
    ],
  },
}

export function resolveApolloLivePilotTestCompanyPreset(
  profile: string | null | undefined,
): ApolloLivePilotTestCompanyPreset | null {
  const key = profile?.trim().toLowerCase().replace(/-/g, "_") ?? ""
  if (!key) return null
  return APOLLO_LIVE_PILOT_TEST_COMPANY_PRESETS[key] ?? null
}

export function mergeApolloLivePilotTestCompanySeedEnv(
  env: NodeJS.ProcessEnv = process.env,
): {
  company_name: string
  domain: string
  website: string
  industry: string
  pilot_profile: string | null
  coverage_tier: "strong" | "weak" | null
} {
  const preset = resolveApolloLivePilotTestCompanyPreset(env.APOLLO_TEST_COMPANY_PROFILE)
  const company_name =
    env.APOLLO_TEST_COMPANY_NAME?.trim() || preset?.company_name || ""
  const domain = env.APOLLO_TEST_COMPANY_DOMAIN?.trim() || preset?.domain || ""
  const website =
    env.APOLLO_TEST_COMPANY_WEBSITE?.trim() || preset?.website || ""
  const industry =
    env.APOLLO_TEST_COMPANY_INDUSTRY?.trim() || preset?.industry || "b2b_services"
  return {
    company_name,
    domain,
    website,
    industry,
    pilot_profile: preset?.profile ?? (env.APOLLO_TEST_COMPANY_PROFILE?.trim() || null),
    coverage_tier: preset?.coverage_tier ?? null,
  }
}
