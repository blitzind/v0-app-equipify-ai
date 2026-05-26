import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
  GrowthContactDiscoveryProviderRawContact,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

/** Role hypotheses only — no email, phone, or LinkedIn. */
function fixtureContactsForCompany(
  companyName: string,
): GrowthContactDiscoveryProviderRawContact[] {
  const industryHint = companyName.toLowerCase()
  const templates: GrowthContactDiscoveryProviderRawContact[] = [
    {
      full_name: "[Fixture] Service Operations Lead",
      job_title: "Director of Service Operations",
      department: "Operations",
      seniority: "director",
      evidence: [
        {
          claim: "Role hypothesis",
          evidence: "Manual fixture — operations leadership pattern for field service accounts.",
          source: "growth.contact_discovery.manual_fixture",
        },
      ],
      source_attribution: [
        {
          source: "growth.contact_discovery.manual_fixture",
          provider_type: "manual_fixture",
          provider_name: "contact_manual_fixture",
          signal: "role_hypothesis",
          evidence: "Fixture role slot — not a verified person record.",
          confidence: 0.55,
        },
      ],
      confidence: 0.55,
      metadata: { fixture: true },
    },
    {
      full_name: "[Fixture] Technical Evaluation Lead",
      job_title: "Technical Manager",
      department: "Engineering",
      seniority: "manager",
      evidence: [
        {
          claim: "Role hypothesis",
          evidence: "Manual fixture — technical evaluation stakeholder.",
          source: "growth.contact_discovery.manual_fixture",
        },
      ],
      source_attribution: [
        {
          source: "growth.contact_discovery.manual_fixture",
          provider_type: "manual_fixture",
          provider_name: "contact_manual_fixture",
          signal: "role_hypothesis",
          evidence: "Fixture technical buyer slot.",
          confidence: 0.5,
        },
      ],
      confidence: 0.5,
    },
    {
      full_name: "[Fixture] Economic Buyer",
      job_title: "VP Finance",
      department: "Finance",
      seniority: "vp",
      evidence: [
        {
          claim: "Role hypothesis",
          evidence: "Manual fixture — economic buyer pattern.",
          source: "growth.contact_discovery.manual_fixture",
        },
      ],
      source_attribution: [
        {
          source: "growth.contact_discovery.manual_fixture",
          provider_type: "manual_fixture",
          provider_name: "contact_manual_fixture",
          signal: "role_hypothesis",
          evidence: "Fixture economic buyer slot.",
          confidence: 0.48,
        },
      ],
      confidence: 0.48,
    },
  ]

  if (industryHint.includes("biomed") || industryHint.includes("imaging")) {
    templates.push({
      full_name: "[Fixture] Clinical Engineering Champion",
      job_title: "Clinical Engineering Manager",
      department: "Clinical Engineering",
      seniority: "manager",
      evidence: [
        {
          claim: "Role hypothesis",
          evidence: "Manual fixture — biomedical equipment champion pattern.",
          source: "growth.contact_discovery.manual_fixture",
        },
      ],
      source_attribution: [
        {
          source: "growth.contact_discovery.manual_fixture",
          provider_type: "manual_fixture",
          provider_name: "contact_manual_fixture",
          signal: "role_hypothesis",
          evidence: "Fixture champion for biomedical accounts.",
          confidence: 0.52,
        },
      ],
      confidence: 0.52,
    })
  }

  return templates
}

export function createManualFixtureContactDiscoveryProvider(): GrowthContactDiscoveryProvider {
  return {
    provider_name: "contact_manual_fixture",
    provider_type: "manual_fixture",
    isConfigured: () => true,
    discover: async (input: GrowthContactDiscoveryProviderQuery) => {
      const contacts = fixtureContactsForCompany(input.company_name).slice(0, input.limit ?? 12)
      return {
        provider_name: "contact_manual_fixture",
        provider_type: "manual_fixture",
        status: "success",
        message: `${contacts.length} fixture role hypothesis(es) — no PII.`,
        contacts,
      }
    },
  }
}
