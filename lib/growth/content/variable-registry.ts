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
    variableKey: "sender.first_name",
    label: "Sender first name",
    description: "Outbound sender first name",
    namespace: "sender",
    allowed: true,
    exampleValue: "Jamie",
    fallbackToken: "",
  },
  {
    variableKey: "sender.last_name",
    label: "Sender last name",
    description: "Outbound sender last name",
    namespace: "sender",
    allowed: true,
    exampleValue: "Rivera",
    fallbackToken: "",
  },
  {
    variableKey: "sender.title",
    label: "Sender title",
    description: "Outbound sender job title",
    namespace: "sender",
    allowed: true,
    exampleValue: "Founder",
    fallbackToken: "",
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
    variableKey: "sender.signature",
    label: "Sender signature",
    description: "Rendered outbound email signature block",
    namespace: "sender",
    allowed: true,
    exampleValue: "Jamie Rivera\nFounder · Equipify",
    fallbackToken: "",
  },
  {
    variableKey: "sender.phone",
    label: "Sender phone",
    description: "Outbound sender phone number",
    namespace: "sender",
    allowed: true,
    exampleValue: "555-0100",
    fallbackToken: "",
  },
  {
    variableKey: "sender.company",
    label: "Sender company",
    description: "Outbound sender company name",
    namespace: "sender",
    allowed: true,
    exampleValue: "Equipify",
    fallbackToken: "",
  },
  {
    variableKey: "sender.website",
    label: "Sender website",
    description: "Outbound sender website URL",
    namespace: "sender",
    allowed: true,
    exampleValue: "equipify.ai",
    fallbackToken: "",
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
    variableKey: "video.page_url",
    label: "Video Page URL",
    description: "Published personalized video page URL (resolved at send time)",
    namespace: "video",
    allowed: true,
    exampleValue: "https://app.equipify.ai/videos/example",
    fallbackToken: "[video page]",
  },
  {
    variableKey: "sendr.page_url",
    label: "Video Page URL (legacy key)",
    description: "Legacy merge key — prefer video.page_url. Still resolved at send time.",
    namespace: "video",
    allowed: true,
    exampleValue: "https://app.equipify.ai/videos/example",
    fallbackToken: "[video page]",
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
