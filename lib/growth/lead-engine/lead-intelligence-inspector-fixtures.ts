import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"

export type LeadIntelligenceInspectorFixture = {
  id: string
  label: string
  input: GrowthLeadEngineSandboxInput
}

export const LEAD_INTELLIGENCE_INSPECTOR_FIXTURES: LeadIntelligenceInspectorFixture[] = [
  {
    id: "medical-equipment",
    label: "Medical Equipment",
    input: {
      companyName: "Precision Biomedical Services",
      domain: "precisionbiomed.example",
      industry: "Medical Equipment Service",
      location: "Tennessee, United States",
      notes:
        "Multi-site clinical equipment maintenance. HTM and field service dispatch coordination.",
    },
  },
  {
    id: "hvac",
    label: "HVAC",
    input: {
      companyName: "Acme Commercial HVAC",
      domain: "acmehvac.example",
      industry: "HVAC",
      location: "Dallas, Texas",
      notes: "Commercial HVAC contractor. ~40 technicians, dispatch and routing pain.",
    },
  },
  {
    id: "garage-door",
    label: "Garage Door",
    input: {
      companyName: "Summit Garage Door Service",
      domain: "summitgarage.example",
      industry: "Garage Door",
      location: "Phoenix, Arizona",
      notes: "Commercial garage door install and repair. Multi-truck field routing.",
    },
  },
  {
    id: "field-service",
    label: "Field Service",
    input: {
      companyName: "Atlas Field Service Group",
      domain: "atlasfield.example",
      industry: "Field Service",
      location: "California, United States",
      notes: "SMB field service operator. ServiceTitan stack, 21–50 employees.",
    },
  },
]

export const LEAD_INTELLIGENCE_INSPECTOR_DEFAULT_INPUT: GrowthLeadEngineSandboxInput =
  LEAD_INTELLIGENCE_INSPECTOR_FIXTURES[0]!.input
