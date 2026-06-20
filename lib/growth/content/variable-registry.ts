import type { GrowthContentVariable } from "@/lib/growth/content/content-types"

export const DEFAULT_CONTENT_VARIABLE_SEED: Array<
  Omit<GrowthContentVariable, "id"> & { variableKey: string }
> = [
  {
    variableKey: "lead.company_name",
    label: "Lead company",
    description: "Prospect company name",
    namespace: "lead",
    allowed: true,
    exampleValue: "Acme Field Service",
    fallbackToken: "[company]",
  },
  {
    variableKey: "lead.contact_name",
    label: "Lead contact",
    description: "Prospect contact name",
    namespace: "lead",
    allowed: true,
    exampleValue: "Alex",
    fallbackToken: "[contact]",
  },
  {
    variableKey: "lead.industry",
    label: "Lead industry",
    description: "Prospect industry vertical",
    namespace: "lead",
    allowed: true,
    exampleValue: "HVAC",
    fallbackToken: "[industry]",
  },
  {
    variableKey: "sender.name",
    label: "Sender name",
    description: "Outbound sender display name",
    namespace: "sender",
    allowed: true,
    exampleValue: "Jamie",
    fallbackToken: "[sender]",
  },
  {
    variableKey: "sender.email",
    label: "Sender email",
    description: "Outbound sender email address",
    namespace: "sender",
    allowed: true,
    exampleValue: "jamie@example.com",
    fallbackToken: "[sender email]",
  },
  {
    variableKey: "sequence.name",
    label: "Sequence name",
    description: "Active sequence name",
    namespace: "sequence",
    allowed: true,
    exampleValue: "Outbound Q2",
    fallbackToken: "[sequence]",
  },
  {
    variableKey: "booking.link",
    label: "Booking link",
    description: "Calendar booking URL",
    namespace: "booking",
    allowed: true,
    exampleValue: "[booking link]",
    fallbackToken: "[booking link]",
  },
  {
    variableKey: "sendr.page_url",
    label: "SENDR page URL",
    description: "Published personalized landing page URL (resolved at send time)",
    namespace: "sendr",
    allowed: true,
    exampleValue: "https://app.equipify.ai/sendr/example",
    fallbackToken: "[sendr page]",
  },
  {
    variableKey: "unsubscribe.link",
    label: "Unsubscribe link",
    description: "Compliance unsubscribe URL",
    namespace: "compliance",
    allowed: true,
    exampleValue: "[unsubscribe link]",
    fallbackToken: "[unsubscribe link]",
  },
  {
    variableKey: "custom.safe_text",
    label: "Safe custom text",
    description: "Operator-approved custom merge text",
    namespace: "custom",
    allowed: true,
    exampleValue: "Custom value",
    fallbackToken: "[custom]",
  },
]

export function buildAllowedVariableKeySet(variables: GrowthContentVariable[]): Set<string> {
  return new Set(variables.filter((v) => v.allowed).map((v) => v.variableKey.toLowerCase()))
}

export function buildVariableFallbackMap(variables: GrowthContentVariable[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const variable of variables) {
    map[variable.variableKey.toLowerCase()] = variable.fallbackToken
  }
  return map
}

export function buildVariableExampleMap(variables: GrowthContentVariable[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const variable of variables) {
    map[variable.variableKey.toLowerCase()] = variable.exampleValue
  }
  return map
}

export function countBlockedVariableAttempts(keys: string[]): number {
  return keys.length
}
