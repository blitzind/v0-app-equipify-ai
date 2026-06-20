import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildSendrCachedVariableMap,
  extractSendrVariablePlaceholders,
  renderSendrPersonalizedText,
  resolveSendrPersonalizationVariables,
} from "@/lib/growth/sendr/growth-sendr-personalization-runtime"
import type { GrowthSendrPersonalizationPreviewResult } from "@/lib/growth/sendr/growth-sendr-types"

export async function previewSendrPersonalization(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    variableMap?: Record<string, string>
    customVariables?: Record<string, string>
    sampleTemplates?: Record<string, string>
    fallbacks?: Record<string, string>
  },
): Promise<GrowthSendrPersonalizationPreviewResult> {
  let leadRecord: Record<string, unknown> | null = null
  if (input.leadId) {
    const { data } = await admin
      .schema("growth")
      .from("leads")
      .select("first_name, last_name, company_name, industry, job_title, city, state")
      .eq("id", input.leadId)
      .maybeSingle()
    leadRecord = (data as Record<string, unknown> | null) ?? null
  }

  const variables = {
    ...buildSendrCachedVariableMap(leadRecord, null, input.variableMap),
    ...(input.customVariables ?? {}),
  }
  const resolved = resolveSendrPersonalizationVariables({
    variables,
    fallbacks: input.fallbacks ?? input.variableMap ?? {},
    customVariables: input.customVariables,
  })

  const missing = Object.entries(resolved)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  const renderedSamples: Record<string, string> = {}
  const templates = input.sampleTemplates ?? {
    hero: "Hi {{first_name}} from {{company_name}}",
    cta: "Book: {{meeting_link}}",
    custom: "{{custom_variables.example}}",
  }
  for (const [key, template] of Object.entries(templates)) {
    renderedSamples[key] = renderSendrPersonalizedText(template, {
      variables,
      fallbacks: input.fallbacks ?? input.variableMap ?? {},
      customVariables: input.customVariables,
    })
    for (const placeholder of extractSendrVariablePlaceholders(template)) {
      if (!resolved[placeholder] && !input.customVariables?.[placeholder]) {
        missing.push(placeholder)
      }
    }
  }

  return {
    resolved,
    fallbacks: input.fallbacks ?? input.variableMap ?? {},
    missing: [...new Set(missing)],
    renderedSamples,
  }
}
