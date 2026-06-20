import {
  GROWTH_SENDR_PERSONALIZATION_VARIABLES,
  type GrowthSendrPersonalizationVariable,
} from "@/lib/growth/sendr/growth-sendr-config"

export type GrowthSendrVariableMap = Partial<
  Record<GrowthSendrPersonalizationVariable | string, string>
>

export type GrowthSendrPersonalizationContext = {
  variables: GrowthSendrVariableMap
  fallbacks?: GrowthSendrVariableMap
  customVariables?: Record<string, string>
}

const VARIABLE_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

/** Deterministic server-side merge — no AI, no realtime recompute. */
export function resolveSendrPersonalizationVariables(
  context: GrowthSendrPersonalizationContext,
): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const key of GROWTH_SENDR_PERSONALIZATION_VARIABLES) {
    const primary = context.variables[key]
    resolved[key] =
      primary && primary.length > 0
        ? primary
        : (context.fallbacks?.[key] ?? "")
  }
  if (context.customVariables) {
    for (const [key, value] of Object.entries(context.customVariables)) {
      resolved[key] = value
    }
  }
  return resolved
}

export function renderSendrPersonalizedText(
  template: string,
  context: GrowthSendrPersonalizationContext,
): string {
  const map = resolveSendrPersonalizationVariables(context)
  return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    if (key === "custom_variables") return ""
    return map[key] ?? context.fallbacks?.[key] ?? ""
  })
}

export function extractSendrVariablePlaceholders(template: string): string[] {
  const found = new Set<string>()
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    if (match[1]) found.add(match[1])
  }
  return [...found]
}

export function buildSendrCachedVariableMap(
  lead: Record<string, unknown> | null | undefined,
  owner: Record<string, unknown> | null | undefined,
  extras?: GrowthSendrVariableMap,
): GrowthSendrVariableMap {
  return {
    first_name: String(lead?.first_name ?? lead?.firstName ?? ""),
    last_name: String(lead?.last_name ?? lead?.lastName ?? ""),
    company_name: String(lead?.company_name ?? lead?.companyName ?? ""),
    industry: String(lead?.industry ?? ""),
    job_title: String(lead?.job_title ?? lead?.jobTitle ?? ""),
    city: String(lead?.city ?? ""),
    state: String(lead?.state ?? ""),
    owner_name: String(owner?.full_name ?? owner?.name ?? ""),
    meeting_link: String(extras?.meeting_link ?? ""),
    ...extras,
  }
}
