import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthCompanyIdentificationAttribution,
  GrowthCompanyIdentificationInput,
  GrowthCompanyIdentificationMatchCandidate,
  GrowthCompanyIdentificationMatchSource,
  GrowthCompanyIdentificationMatchType,
} from "@/lib/growth/company-identification/company-identification-types"
import {
  domainToCompanyNameHint,
  extractBusinessReferrerDomain,
  extractDomainFromEmail,
  isConsumerEmailDomain,
  isSearchEngineHost,
  normalizeCompanyName,
  normalizeDomain,
} from "@/lib/growth/company-identification/company-identification-normalize"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function buildAttribution(
  source: string,
  section: string,
  signal: string,
  evidence: string,
  confidence: number,
): GrowthCompanyIdentificationAttribution {
  return { source, section, signal, evidence, confidence }
}

function pushCandidate(
  list: GrowthCompanyIdentificationMatchCandidate[],
  candidate: GrowthCompanyIdentificationMatchCandidate,
): void {
  const key = [
    candidate.company_domain ?? "",
    candidate.company_name,
    candidate.matched_source,
    candidate.match_type,
  ].join("|")
  if (list.some((c) => [c.company_domain ?? "", c.company_name, c.matched_source, c.match_type].join("|") === key)) {
    return
  }
  list.push(candidate)
}

function observableCandidate(params: {
  company_name: string
  company_domain: string | null
  matched_source: GrowthCompanyIdentificationMatchSource
  match_type: GrowthCompanyIdentificationMatchType
  match_confidence: number
  match_score: number
  evidence: string
  reasoning: string[]
  attribution: GrowthCompanyIdentificationAttribution[]
  metadata?: Record<string, unknown>
}): GrowthCompanyIdentificationMatchCandidate {
  return {
    company_name: params.company_name,
    company_domain: params.company_domain,
    matched_customer_id: null,
    matched_prospect_id: null,
    matched_growth_lead_id: null,
    matched_source: params.matched_source,
    match_type: params.match_type,
    match_confidence: params.match_confidence,
    match_score: params.match_score,
    match_reasoning: params.reasoning,
    evidence: params.evidence,
    source_attribution: params.attribution,
    metadata: params.metadata ?? {},
  }
}

export function buildObservableCompanyMatches(
  input: GrowthCompanyIdentificationInput,
): GrowthCompanyIdentificationMatchCandidate[] {
  const matches: GrowthCompanyIdentificationMatchCandidate[] = []

  const submittedName = normalizeCompanyName(input.submitted_company_name)
  const explicitDomain = normalizeDomain(input.company_domain)
  const emailDomain = extractDomainFromEmail(input.email)
  const landingDomain = normalizeDomain(input.landing_page)
  const referrerDomain = extractBusinessReferrerDomain(input.referrer)

  if (submittedName) {
    pushCandidate(
      matches,
      observableCandidate({
        company_name: submittedName,
        company_domain: explicitDomain ?? (emailDomain && !isConsumerEmailDomain(emailDomain) ? emailDomain : null),
        matched_source: "submitted_identity",
        match_type: "submitted_company",
        match_confidence: 0.92,
        match_score: 90,
        evidence: `Submitted company name "${submittedName}" from explicit identity capture.`,
        reasoning: ["Explicit submitted identity — candidate match, not verified truth."],
        attribution: [
          buildAttribution(
            "growth.company_identification_matches",
            "identity",
            "submitted_company",
            `Submitted company: ${submittedName}`,
            0.92,
          ),
        ],
      }),
    )
  }

  if (emailDomain && !isConsumerEmailDomain(emailDomain)) {
    pushCandidate(
      matches,
      observableCandidate({
        company_name: submittedName || domainToCompanyNameHint(emailDomain),
        company_domain: emailDomain,
        matched_source: "email_domain",
        match_type: "email_domain",
        match_confidence: 0.85,
        match_score: 82,
        evidence: `Business email domain ${emailDomain} from explicit capture.`,
        reasoning: ["Email domain match — requires human verification."],
        attribution: [
          buildAttribution(
            "growth.company_identification_matches",
            "identity",
            "email_domain",
            `Email domain ${emailDomain}`,
            0.85,
          ),
        ],
      }),
    )
  } else if (emailDomain && isConsumerEmailDomain(emailDomain)) {
    // skip — consumer domain not used for company ID
  }

  if (landingDomain && !isSearchEngineHost(landingDomain)) {
    pushCandidate(
      matches,
      observableCandidate({
        company_name: submittedName || domainToCompanyNameHint(landingDomain),
        company_domain: landingDomain,
        matched_source: "landing_page_domain",
        match_type: explicitDomain === landingDomain ? "exact_domain" : "normalized_domain",
        match_confidence: 0.72,
        match_score: 68,
        evidence: `Landing page host ${landingDomain} observed in session.`,
        reasoning: ["Landing page domain inference — candidate only."],
        attribution: [
          buildAttribution(
            "growth.company_identification_matches",
            "session",
            "landing_page",
            input.landing_page ?? landingDomain,
            0.72,
          ),
        ],
      }),
    )
  }

  if (referrerDomain) {
    pushCandidate(
      matches,
      observableCandidate({
        company_name: submittedName || domainToCompanyNameHint(referrerDomain),
        company_domain: referrerDomain,
        matched_source: "referrer_domain",
        match_type: "inferred_company",
        match_confidence: 0.55,
        match_score: 45,
        evidence: `Referrer host ${referrerDomain} — weak company signal, not search-query access.`,
        reasoning: ["Referrer domain only — low confidence candidate."],
        attribution: [
          buildAttribution(
            "growth.company_identification_matches",
            "session",
            "referrer",
            input.referrer ?? referrerDomain,
            0.55,
          ),
        ],
      }),
    )
  }

  if (explicitDomain && !matches.some((m) => m.company_domain === explicitDomain)) {
    pushCandidate(
      matches,
      observableCandidate({
        company_name: submittedName || domainToCompanyNameHint(explicitDomain),
        company_domain: explicitDomain,
        matched_source: "company_domain_parameter",
        match_type: "exact_domain",
        match_confidence: 0.78,
        match_score: 75,
        evidence: `Explicit company domain parameter ${explicitDomain}.`,
        reasoning: ["Domain parameter supplied in bridge context."],
        attribution: [
          buildAttribution(
            "growth.company_identification_matches",
            "input",
            "company_domain",
            explicitDomain,
            0.78,
          ),
        ],
      }),
    )
  }

  const utmDomain = normalizeDomain(input.utm_campaign) ?? normalizeDomain(input.utm_source)
  if (utmDomain && utmDomain.includes(".") && !isSearchEngineHost(utmDomain)) {
    pushCandidate(
      matches,
      observableCandidate({
        company_name: domainToCompanyNameHint(utmDomain),
        company_domain: utmDomain,
        matched_source: "utm_domain",
        match_type: "inferred_company",
        match_confidence: 0.5,
        match_score: 40,
        evidence: `UTM field resembles domain ${utmDomain} — weak inference only.`,
        reasoning: ["UTM domain inference — verify before use."],
        attribution: [
          buildAttribution(
            "growth.company_identification_matches",
            "utm",
            "domain_hint",
            `utm_source=${input.utm_source} utm_campaign=${input.utm_campaign}`,
            0.5,
          ),
        ],
      }),
    )
  }

  return matches
}

export async function resolveCrmCompanyMatches(
  admin: SupabaseClient | null | undefined,
  input: GrowthCompanyIdentificationInput,
): Promise<GrowthCompanyIdentificationMatchCandidate[]> {
  if (!admin) return []

  const matches: GrowthCompanyIdentificationMatchCandidate[] = []
  const email = (input.email ?? "").trim().toLowerCase()
  const domain =
    normalizeDomain(input.company_domain) ??
    extractDomainFromEmail(input.email) ??
    normalizeDomain(input.landing_page)
  const company = normalizeCompanyName(input.submitted_company_name ?? input.company_name)

  try {
    if (email) {
      const { data } = await admin
        .schema("growth")
        .from("leads")
        .select("id, company_name, website")
        .eq("contact_email", email)
        .limit(3)
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const leadId = asString(row.id)
        const name = asString(row.company_name) || company || "Unknown"
        const leadDomain = normalizeDomain(asString(row.website))
        pushCandidate(
          matches,
          observableCandidate({
            company_name: name,
            company_domain: leadDomain ?? domain,
            matched_source: "growth_lead",
            match_type: "crm_match",
            match_confidence: 0.88,
            match_score: 86,
            evidence: `Matched growth.leads by email ${email}.`,
            reasoning: ["CRM growth lead match — candidate association."],
            attribution: [
              buildAttribution("growth.leads", "crm", "email", `lead_id=${leadId}`, 0.88),
            ],
            metadata: { matched_growth_lead_id: leadId },
          }),
        )
        const last = matches[matches.length - 1]
        if (last) last.matched_growth_lead_id = leadId
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (company) {
      const { data } = await admin
        .from("customers")
        .select("id, company_name")
        .ilike("company_name", company)
        .limit(3)
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const customerId = asString(row.id)
        const name = asString(row.company_name) || company
        const candidate = observableCandidate({
          company_name: name,
          company_domain: domain,
          matched_source: "crm_customer",
          match_type: "crm_match",
          match_confidence: 0.9,
          match_score: 88,
          evidence: `Matched customers by company name ${company}.`,
          reasoning: ["CRM customer match — candidate association."],
          attribution: [
            buildAttribution("public.customers", "crm", "company_name", name, 0.9),
          ],
        })
        candidate.matched_customer_id = customerId
        pushCandidate(matches, candidate)
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (company) {
      const { data } = await admin
        .from("prospects")
        .select("id, company_name")
        .ilike("company_name", company)
        .limit(3)
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const prospectId = asString(row.id)
        const name = asString(row.company_name) || company
        const candidate = observableCandidate({
          company_name: name,
          company_domain: domain,
          matched_source: "crm_prospect",
          match_type: "crm_match",
          match_confidence: 0.86,
          match_score: 84,
          evidence: `Matched prospects by company name ${company}.`,
          reasoning: ["CRM prospect match — candidate association."],
          attribution: [
            buildAttribution("public.prospects", "crm", "company_name", name, 0.86),
          ],
        })
        candidate.matched_prospect_id = prospectId
        pushCandidate(matches, candidate)
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (domain) {
      const { data } = await admin
        .schema("growth")
        .from("leads")
        .select("id, company_name, website")
        .ilike("website", `%${domain}%`)
        .limit(3)
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const leadId = asString(row.id)
        const name = asString(row.company_name) || domainToCompanyNameHint(domain)
        const candidate = observableCandidate({
          company_name: name,
          company_domain: domain,
          matched_source: "growth_lead",
          match_type: "crm_match",
          match_confidence: 0.82,
          match_score: 80,
          evidence: `Matched growth.leads by domain ${domain}.`,
          reasoning: ["Growth lead domain match."],
          attribution: [
            buildAttribution("growth.leads", "crm", "domain", domain, 0.82),
          ],
        })
        candidate.matched_growth_lead_id = leadId
        pushCandidate(matches, candidate)
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (input.intent_session_id) {
      const { data } = await admin
        .schema("growth")
        .from("intent_visitor_sessions")
        .select("id, last_page_url, first_landing_url")
        .eq("id", input.intent_session_id)
        .maybeSingle()
      if (data) {
        const row = data as Record<string, unknown>
        const sessionDomain =
          normalizeDomain(asString(row.last_page_url)) ??
          normalizeDomain(asString(row.first_landing_url))
        if (sessionDomain && !matches.some((m) => m.company_domain === sessionDomain)) {
          pushCandidate(
            matches,
            observableCandidate({
              company_name: domainToCompanyNameHint(sessionDomain),
              company_domain: sessionDomain,
              matched_source: "intent_history",
              match_type: "normalized_domain",
              match_confidence: 0.7,
              match_score: 65,
              evidence: `Intent session pages resolve to domain ${sessionDomain}.`,
              reasoning: ["Intent history domain association."],
              attribution: [
                buildAttribution(
                  "growth.intent_visitor_sessions",
                  "session",
                  "page_domain",
                  asString(row.last_page_url) || sessionDomain,
                  0.7,
                ),
              ],
            }),
          )
        }
      }
    }
  } catch {
    // fault isolated
  }

  return matches
}

export function rankCompanyIdentificationMatches(
  matches: GrowthCompanyIdentificationMatchCandidate[],
): GrowthCompanyIdentificationMatchCandidate[] {
  const sourceRank: Record<GrowthCompanyIdentificationMatchSource, number> = {
    submitted_identity: 0,
    email_domain: 1,
    crm_customer: 2,
    crm_prospect: 3,
    growth_lead: 4,
    intent_history: 5,
    landing_page_domain: 6,
    company_domain_parameter: 7,
    referrer_domain: 8,
    utm_domain: 9,
    future_provider: 10,
  }

  return [...matches].sort((a, b) => {
    const sourceDelta = (sourceRank[a.matched_source] ?? 99) - (sourceRank[b.matched_source] ?? 99)
    if (sourceDelta !== 0) return sourceDelta
    return b.match_score - a.match_score
  })
}
