/** GE-PROVIDERS-1A — Production provider fusion order for Apollo + PDL. Client-safe. */

export const GROWTH_PDL_PROVIDER_FUSION_QA_MARKER =
  "growth-pdl-provider-fusion-ge-providers-1a-v1" as const

export type ProviderFusionChannel =
  | "contact_discovery"
  | "contact_acquisition"
  | "email_discovery"
  | "phone_discovery"
  | "company_intelligence"
  | "buying_committee"

export type ProviderFusionStep = {
  provider: "internal" | "website" | "pdl" | "apollo"
  mode: "parallel" | "sequential" | "fallback"
  rationale: string
}

export type ProviderFusionPlan = {
  qa_marker: typeof GROWTH_PDL_PROVIDER_FUSION_QA_MARKER
  channel: ProviderFusionChannel
  order: ProviderFusionStep[]
  summary: string
}

/**
 * Production fusion order — internal sources first, then cost-efficient PDL augmentation,
 * then credit-consuming Apollo when explicitly enabled.
 */
export function resolveProductionProviderFusionPlan(input: {
  channel: ProviderFusionChannel
  apollo_available: boolean
  pdl_available: boolean
  apollo_primary?: boolean
}): ProviderFusionPlan {
  const apolloPrimary = input.apollo_primary === true

  if (input.channel === "contact_discovery" || input.channel === "contact_acquisition") {
    if (apolloPrimary && input.apollo_available) {
      return {
        qa_marker: GROWTH_PDL_PROVIDER_FUSION_QA_MARKER,
        channel: input.channel,
        summary:
          "Apollo-primary: internal → Apollo → website → PDL fallback. Apollo leads when primary acquisition is enabled.",
        order: [
          { provider: "internal", mode: "sequential", rationale: "Zero-cost CRM and prior discovery wins." },
          { provider: "apollo", mode: "sequential", rationale: "Highest contact yield when credits approved." },
          { provider: "website", mode: "sequential", rationale: "Public team/about pages fill gaps without API cost." },
          {
            provider: "pdl",
            mode: "fallback",
            rationale: "PDL augments remaining gaps with person search; lower cost than bulk Apollo enrich.",
          },
        ],
      }
    }

    const order: ProviderFusionStep[] = [
      { provider: "internal", mode: "sequential", rationale: "Zero-cost CRM and prior discovery wins." },
      { provider: "website", mode: "sequential", rationale: "Public pages before paid APIs." },
    ]
    if (input.pdl_available) {
      order.push({
        provider: "pdl",
        mode: "sequential",
        rationale:
          "PDL person search augments sparse accounts before Apollo credits; good speed/cost for titles and LinkedIn.",
      })
    }
    if (input.apollo_available) {
      order.push({
        provider: "apollo",
        mode: "sequential",
        rationale:
          "Apollo tiered search last — highest yield but credit-consuming; runs only when explicitly enabled.",
      })
    }

    return {
      qa_marker: GROWTH_PDL_PROVIDER_FUSION_QA_MARKER,
      channel: input.channel,
      summary:
        "Default: internal → website → PDL → Apollo. PDL before Apollo for cost control; Apollo adds depth when enabled.",
      order,
    }
  }

  if (input.channel === "email_discovery" || input.channel === "phone_discovery") {
    const order: ProviderFusionStep[] = [
      { provider: "website", mode: "sequential", rationale: "Pattern and page extraction before paid lookup." },
    ]
    if (input.pdl_available) {
      order.push({
        provider: "pdl",
        mode: "sequential",
        rationale: "PDL person enrich/search for known identity context.",
      })
    }
    if (input.apollo_available) {
      order.push({
        provider: "apollo",
        mode: "fallback",
        rationale: "Apollo bulk_match when enrichment ACK enabled — credit-consuming fallback.",
      })
    }
    return {
      qa_marker: GROWTH_PDL_PROVIDER_FUSION_QA_MARKER,
      channel: input.channel,
      summary: "Website → PDL identity lookup → Apollo enrich fallback.",
      order,
    }
  }

  if (input.channel === "company_intelligence") {
    const order: ProviderFusionStep[] = [
      { provider: "internal", mode: "sequential", rationale: "Canonical company row and prior snapshots." },
      { provider: "website", mode: "sequential", rationale: "Crawl-based firmographics and tech signals." },
    ]
    if (input.pdl_available) {
      order.push({
        provider: "pdl",
        mode: "sequential",
        rationale: "PDL company enrich for industry, size, HQ, and tech tags.",
      })
    }
    return {
      qa_marker: GROWTH_PDL_PROVIDER_FUSION_QA_MARKER,
      channel: input.channel,
      summary: "Internal → website crawl → PDL company enrich.",
      order,
    }
  }

  return {
    qa_marker: GROWTH_PDL_PROVIDER_FUSION_QA_MARKER,
    channel: input.channel,
    summary:
      "Buying committee consumes canonical persons and company_contacts — fed by upstream contact discovery fusion.",
    order: [
      { provider: "internal", mode: "sequential", rationale: "Canonical roles and verified contacts." },
      { provider: "pdl", mode: "sequential", rationale: "PDL-sourced contacts with titles feed committee classification." },
      { provider: "apollo", mode: "sequential", rationale: "Apollo-sourced contacts merge via identity fusion." },
    ],
  }
}
