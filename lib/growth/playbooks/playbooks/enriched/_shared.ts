/** GS-AI-PLAYBOOK-2A — Shared enrichment content factories (client-safe). */

import type {
  GrowthIndustryPlaybookBuyerPersona,
  GrowthIndustryPlaybookCompetitorProfile,
  GrowthIndustryPlaybookStructuredObjection,
} from "@/lib/growth/playbooks/industry-playbook-types"

export function buildBuyerPersona(input: {
  title: string
  goals: string[]
  kpis: string[]
  frustrations: string[]
  buyingTriggers: string[]
  commonObjections: string[]
  successMetrics: string[]
}): GrowthIndustryPlaybookBuyerPersona {
  return input
}

export function buildStructuredObjection(
  objection: string,
  recommendedResponse: string,
  recommendedDiscoveryQuestion: string,
): GrowthIndustryPlaybookStructuredObjection {
  return { objection, recommendedResponse, recommendedDiscoveryQuestion }
}

export const STANDARD_FIELD_SERVICE_COMPETITORS: GrowthIndustryPlaybookCompetitorProfile[] = [
  {
    competitor: "ServiceTitan",
    strengths: ["Strong residential HVAC brand", "Marketing and dispatch for home services"],
    weaknesses: ["Heavy implementation for complex asset programs", "Less flexible for regulated PM workflows"],
    migrationOpportunities: [
      "Teams outgrowing residential-first workflows",
      "Need asset-centric history beyond job tickets",
    ],
  },
  {
    competitor: "FieldEdge",
    strengths: ["Contractor-friendly quoting", "Quick setup for small teams"],
    weaknesses: ["Limited multi-site asset visibility", "Reporting depth for compliance programs"],
    migrationOpportunities: ["Growing PM contract volume", "Need unified equipment register"],
  },
  {
    competitor: "ServiceMax",
    strengths: ["Enterprise field service depth", "Strong OEM and asset models"],
    weaknesses: ["Long implementation cycles", "Higher total cost of ownership"],
    migrationOpportunities: ["Mid-market teams needing enterprise patterns without enterprise timelines"],
  },
  {
    competitor: "Salesforce Field Service",
    strengths: ["CRM-native service", "Flexible platform ecosystem"],
    weaknesses: ["Requires admin-heavy configuration", "Asset PM often custom-built"],
    migrationOpportunities: ["CRM-heavy orgs wanting faster operational rollout"],
  },
  {
    competitor: "Housecall Pro",
    strengths: ["Simple scheduling for owner-operators", "Consumer booking flows"],
    weaknesses: ["Not built for complex PM or compliance", "Weak multi-location asset history"],
    migrationOpportunities: ["Teams adding commercial contracts and PM programs"],
  },
  {
    competitor: "BigChange",
    strengths: ["Fleet and job tracking", "European market strength"],
    weaknesses: ["US workflow fit varies", "Asset lifecycle depth limited"],
    migrationOpportunities: ["US expansion needing localized compliance workflows"],
  },
  {
    competitor: "QuickBooks + spreadsheets",
    strengths: ["Familiar billing", "Low upfront cost"],
    weaknesses: ["No dispatch-to-asset linkage", "Manual PM and documentation"],
    migrationOpportunities: ["Billing works but operations outgrew spreadsheets"],
  },
]

export function discoveryByCategory(categories: Record<string, string[]>): string[] {
  return Object.values(categories).flat()
}

export function storylinesFromThemes(
  themes: Array<{ theme: string; title: string; hook: string; audience: string }>,
): Array<{ title: string; hook: string; audience: string; theme: string }> {
  return themes
}
