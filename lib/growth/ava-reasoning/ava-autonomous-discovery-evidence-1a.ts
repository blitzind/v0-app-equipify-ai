/** AVA-SIMPLE-GPT-QUALIFICATION-1A — Assemble best-available evidence for autonomous GPT reasoning (client-safe). */

import type { AvaDirectWebsiteRetrievalResult } from "@/lib/growth/ava-reasoning/ava-direct/ava-direct-website-retrieval"

export const AVA_AUTONOMOUS_DISCOVERY_EVIDENCE_1A_QA_MARKER =
  "ava-simple-gpt-qualification-1a-evidence-v1" as const

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildDatamoonEvidenceAppendix(
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return ""

  const lines: string[] = []
  const datamoon = metadata.datamoon
  if (datamoon && typeof datamoon === "object" && !Array.isArray(datamoon)) {
    const dm = datamoon as Record<string, unknown>
    for (const [key, label] of [
      ["companyName", "DataMoon company name"],
      ["companyDomain", "DataMoon company domain"],
      ["industry", "DataMoon industry"],
      ["contactName", "DataMoon contact name"],
      ["contactTitle", "DataMoon contact title"],
      ["contactEmail", "DataMoon contact email"],
      ["providerCompanyId", "DataMoon provider company id"],
    ] as const) {
      const value = trimOrNull(dm[key])
      if (value) lines.push(`${label}: ${value}`)
    }
  }

  const datamoonIntake = metadata.datamoon_intake
  if (datamoonIntake && typeof datamoonIntake === "object" && !Array.isArray(datamoonIntake)) {
    const intake = datamoonIntake as Record<string, unknown>
    for (const [key, label] of [
      ["company_domain", "DataMoon intake domain"],
      ["primary_industry", "DataMoon intake industry"],
      ["job_title", "DataMoon intake job title"],
      ["department", "DataMoon intake department"],
      ["provider_company_id", "DataMoon intake provider company id"],
    ] as const) {
      const value = trimOrNull(intake[key])
      if (value) lines.push(`${label}: ${value}`)
    }
  }

  const prospectSearch = metadata.prospect_search
  if (prospectSearch && typeof prospectSearch === "object" && !Array.isArray(prospectSearch)) {
    const ps = prospectSearch as Record<string, unknown>
    const query = trimOrNull(ps.query)
    if (query) lines.push(`Discovery search query: ${query}`)
    const sourceId = trimOrNull(ps.source_id)
    if (sourceId) lines.push(`Discovery source id: ${sourceId}`)
  }

  if (lines.length === 0) return ""
  return `\n\n--- DataMoon discovery context ---\n${lines.join("\n")}`
}

export function buildAutonomousDiscoveryEvidenceText(input: {
  companyName: string
  website: string | null
  websiteRetrieval: AvaDirectWebsiteRetrievalResult | null
  metadata: Record<string, unknown> | null | undefined
}): string {
  const sections: string[] = [`Company name: ${input.companyName.trim()}`]

  const websiteUrl =
    trimOrNull(input.websiteRetrieval?.normalizedUrl) ?? trimOrNull(input.website)
  if (websiteUrl) {
    sections.push(`Company website URL: ${websiteUrl}`)
  }

  if (input.websiteRetrieval?.ok && input.websiteRetrieval.text.trim()) {
    sections.push("", "--- Public website excerpts ---", input.websiteRetrieval.text.trim())
  } else if (websiteUrl) {
    sections.push(
      "",
      "--- Public website excerpts ---",
      "Homepage content was not retrieved successfully.",
      input.websiteRetrieval?.message
        ? `Retrieval note: ${input.websiteRetrieval.message}`
        : "No homepage fetch was attempted or content was empty.",
    )
  } else {
    sections.push("", "--- Public website excerpts ---", "No company website URL is available.")
  }

  const datamoonAppendix = buildDatamoonEvidenceAppendix(input.metadata)
  if (datamoonAppendix.trim()) {
    sections.push(datamoonAppendix.trim())
  }

  sections.push(
    "",
    "--- Evidence guidance ---",
    "Evaluate pursue, hold, or reject from the evidence above plus Equipify seller knowledge.",
    "Use hold (not reject) when company identity is credible but evidence is genuinely insufficient.",
    "Use reject only when available evidence supports a non-fit for Equipify's sales objective.",
  )

  return sections.join("\n")
}
