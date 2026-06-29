import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { detectCareersPageEvidence, CAREERS_CRAWL_PATHS } from "@/lib/growth/company-growth-signals/detectors/careers-hiring-detector"
import { detectTechStackSignals } from "@/lib/growth/company-growth-signals/detectors/tech-stack-signal-detector"
import {
  baseConfidenceForCompanyIntelligenceSource,
  confidenceTierForCompanyIntelligence,
} from "@/lib/growth/company-intelligence/company-intelligence-confidence"
import {
  buildNormalizedIntelligenceKey,
  normalizeIntelligenceValueText,
  normalizeSocialPresenceKey,
  normalizeTechnologyIntelligenceKey,
  normalizeWebsiteSignalKey,
} from "@/lib/growth/company-intelligence/company-intelligence-normalize"
import {
  extractMetaDescriptionFromHtml,
  extractSchemaOrgOrganizationsFromHtml,
} from "@/lib/growth/company-intelligence/company-intelligence-schema-org"
import type { GrowthCompanyIntelligenceDraftFinding } from "@/lib/growth/company-intelligence/company-intelligence-types"
import { detectWebsiteFeatureFlags } from "@/lib/growth/research/website-maturity-score"
import { detectWebsiteTechnologies } from "@/lib/growth/research/technology-detector"
import { fetchLeadWebsite } from "@/lib/growth/research-website-fetch"
import { resolveReadyLeadWebsiteUrl } from "@/lib/growth/research-website-url"
import { discoverWebsiteContacts } from "@/lib/growth/contact-discovery/website-contact-discovery"

export type CompanyIntelligenceContext = {
  company_id: string
  company_name: string
  primary_domain: string | null
  website_url: string | null
  industry: string | null
  subindustry: string | null
  employee_range: string | null
  city: string | null
  state: string | null
  country: string | null
  technologies: string[]
}

function draftFinding(
  partial: Omit<GrowthCompanyIntelligenceDraftFinding, "finding_ref" | "confidence_tier" | "normalized_intelligence_key"> &
    Partial<Pick<GrowthCompanyIntelligenceDraftFinding, "finding_ref">>,
): GrowthCompanyIntelligenceDraftFinding {
  const finding_ref = partial.finding_ref ?? randomUUID()
  const confidence = partial.confidence
  return {
    ...partial,
    finding_ref,
    normalized_intelligence_key: buildNormalizedIntelligenceKey({
      intelligence_category: partial.intelligence_category,
      intelligence_key: partial.intelligence_key,
    }),
    confidence_tier: confidenceTierForCompanyIntelligence({
      source: partial.source,
      verification_status: "unverified",
      base_confidence: confidence,
    }),
  }
}

function dedupeFindings(drafts: GrowthCompanyIntelligenceDraftFinding[]): GrowthCompanyIntelligenceDraftFinding[] {
  const byKey = new Map<string, GrowthCompanyIntelligenceDraftFinding>()
  for (const draft of drafts) {
    const existing = byKey.get(draft.normalized_intelligence_key)
    if (!existing || draft.confidence > existing.confidence) {
      byKey.set(draft.normalized_intelligence_key, draft)
    }
  }
  return [...byKey.values()]
}

export async function loadCompanyIntelligenceContext(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<CompanyIntelligenceContext | null> {
  const { data: company, error } = await admin
    .schema("growth")
    .from("companies")
    .select(
      "id, display_name, primary_domain, website, industry, subindustry, employee_range, city, state, country, technologies",
    )
    .eq("id", input.company_id)
    .maybeSingle()
  if (error || !company) return null

  const technologies = Array.isArray(company.technologies)
    ? (company.technologies as unknown[]).filter((t): t is string => typeof t === "string" && t.trim())
    : []

  return {
    company_id: company.id as string,
    company_name: (typeof company.display_name === "string" && company.display_name) || "",
    primary_domain: typeof company.primary_domain === "string" ? company.primary_domain : null,
    website_url: typeof company.website === "string" ? company.website : null,
    industry: typeof company.industry === "string" ? company.industry : null,
    subindustry: typeof company.subindustry === "string" ? company.subindustry : null,
    employee_range: typeof company.employee_range === "string" ? company.employee_range : null,
    city: typeof company.city === "string" ? company.city : null,
    state: typeof company.state === "string" ? company.state : null,
    country: typeof company.country === "string" ? company.country : null,
    technologies,
  }
}

export function collectCanonicalCompanyIntelligenceFindings(
  ctx: CompanyIntelligenceContext,
): GrowthCompanyIntelligenceDraftFinding[] {
  const drafts: GrowthCompanyIntelligenceDraftFinding[] = []
  const base = baseConfidenceForCompanyIntelligenceSource("canonical_company")

  const fields: Array<{
    category: GrowthCompanyIntelligenceDraftFinding["intelligence_category"]
    key: string
    value: string | null
    field: string
  }> = [
    { category: "industry", key: "industry", value: ctx.industry, field: "industry" },
    { category: "sub_industry", key: "subindustry", value: ctx.subindustry, field: "subindustry" },
    { category: "company_size", key: "employee_range", value: ctx.employee_range, field: "employee_range" },
    { category: "location", key: "city", value: ctx.city, field: "city" },
    { category: "location", key: "state", value: ctx.state, field: "state" },
    { category: "location", key: "country", value: ctx.country, field: "country" },
  ]

  for (const row of fields) {
    const value = normalizeIntelligenceValueText(row.value)
    if (!value) continue
    drafts.push(
      draftFinding({
        intelligence_category: row.category,
        intelligence_key: row.key,
        value_text: value,
        value_json: null,
        source: "canonical_company",
        confidence: base,
        provider_name: "canonical_companies",
        discovery_source: `canonical_field:${row.field}`,
        evidence: [
          {
            evidence_type: "canonical_field",
            source_record_id: ctx.company_id,
            extraction_method: "canonical_company_row",
            evidence_text: `${row.field}=${value}`,
            confidence: base,
          },
        ],
      }),
    )
  }

  for (const tech of ctx.technologies.slice(0, 25)) {
    const value = normalizeIntelligenceValueText(tech)
    if (!value) continue
    drafts.push(
      draftFinding({
        intelligence_category: "technology",
        intelligence_key: normalizeTechnologyIntelligenceKey(value),
        value_text: value,
        value_json: { technology: value },
        source: "canonical_company",
        confidence: base,
        provider_name: "canonical_companies",
        discovery_source: "canonical_field:technologies",
        evidence: [
          {
            evidence_type: "canonical_field",
            source_record_id: ctx.company_id,
            extraction_method: "canonical_technologies_json",
            evidence_text: value,
            confidence: base,
          },
        ],
      }),
    )
  }

  return drafts
}

export async function collectStagingCompanyIntelligenceFindings(
  admin: SupabaseClient,
  ctx: CompanyIntelligenceContext,
): Promise<{ drafts: GrowthCompanyIntelligenceDraftFinding[]; messages: string[] }> {
  const messages: string[] = []
  const { data: lineage, error: lErr } = await admin
    .schema("growth")
    .from("company_source_lineage")
    .select("source_table, source_id, provider_name, confidence")
    .eq("company_id", ctx.company_id)
    .limit(50)
  if (lErr) {
    messages.push(`Staging lineage skipped: ${lErr.message}`)
    return { drafts: [], messages }
  }
  if (!lineage?.length) {
    messages.push("Staging source skipped: no company_source_lineage rows.")
    return { drafts: [], messages }
  }

  const drafts: GrowthCompanyIntelligenceDraftFinding[] = []
  const base = baseConfidenceForCompanyIntelligenceSource("staging_company")

  for (const row of lineage) {
    const source_table = typeof row.source_table === "string" ? row.source_table : ""
    const source_id = typeof row.source_id === "string" ? row.source_id : ""
    if (!source_id) continue

    if (source_table === "external_company_candidates") {
      const { data: ext } = await admin
        .schema("growth")
        .from("external_company_candidates")
        .select("id, company_name, industry, category, website, city, state, country, confidence, evidence")
        .eq("id", source_id)
        .maybeSingle()
      if (!ext) continue
      const industry = normalizeIntelligenceValueText(ext.industry ?? ext.category)
      if (industry) {
        drafts.push(
          draftFinding({
            intelligence_category: "industry",
            intelligence_key: "industry",
            value_text: industry,
            value_json: null,
            source: "staging_company",
            confidence: Math.min(0.92, base + 0.05),
            provider_name: typeof ext.company_name === "string" ? "external_company_candidates" : "staging",
            discovery_source: `staging:${source_table}`,
            staging_trusted: Number(ext.confidence) >= 0.85,
            evidence: [
              {
                evidence_type: "staging_row",
                source_record_id: source_id,
                extraction_method: "external_company_candidates.industry",
                evidence_text: `industry=${industry}`,
                confidence: base,
              },
            ],
          }),
        )
      }
      const city = normalizeIntelligenceValueText(ext.city)
      if (city) {
        drafts.push(
          draftFinding({
            intelligence_category: "location",
            intelligence_key: "city",
            value_text: city,
            value_json: null,
            source: "staging_company",
            confidence: base,
            provider_name: "external_company_candidates",
            discovery_source: `staging:${source_table}`,
            evidence: [
              {
                evidence_type: "staging_row",
                source_record_id: source_id,
                extraction_method: "external_company_candidates.city",
                evidence_text: `city=${city}`,
                confidence: base,
              },
            ],
          }),
        )
      }
    }

    if (source_table === "real_world_company_candidates") {
      const { data: rwc } = await admin
        .schema("growth")
        .from("real_world_company_candidates")
        .select("id, company_name, industry, website, city, state, country, confidence")
        .eq("id", source_id)
        .maybeSingle()
      if (!rwc) continue
      const industry = normalizeIntelligenceValueText(rwc.industry)
      if (industry) {
        drafts.push(
          draftFinding({
            intelligence_category: "industry",
            intelligence_key: "industry",
            value_text: industry,
            value_json: null,
            source: "staging_company",
            confidence: base,
            provider_name: "real_world_company_candidates",
            discovery_source: `staging:${source_table}`,
            staging_trusted: Number(rwc.confidence) >= 0.85,
            evidence: [
              {
                evidence_type: "staging_row",
                source_record_id: source_id,
                extraction_method: "real_world_company_candidates.industry",
                evidence_text: `industry=${industry}`,
                confidence: base,
              },
            ],
          }),
        )
      }
    }
  }

  return { drafts, messages }
}

export async function collectCanonicalSocialIntelligenceFindings(
  admin: SupabaseClient,
  ctx: CompanyIntelligenceContext,
): Promise<GrowthCompanyIntelligenceDraftFinding[]> {
  const { data: profiles } = await admin
    .schema("growth")
    .from("company_profiles")
    .select("id, profile_type, profile_url, confidence, verification_status")
    .eq("company_id", ctx.company_id)
    .limit(20)

  const base = baseConfidenceForCompanyIntelligenceSource("canonical_social")
  const drafts: GrowthCompanyIntelligenceDraftFinding[] = []

  for (const row of profiles ?? []) {
    const profile_type = typeof row.profile_type === "string" ? row.profile_type : "unknown"
    const profile_url = typeof row.profile_url === "string" ? row.profile_url.trim() : ""
    if (!profile_url) continue
    const key = normalizeSocialPresenceKey(profile_type)
    drafts.push(
      draftFinding({
        intelligence_category: "social_presence",
        intelligence_key: key,
        value_text: profile_url,
        value_json: { profile_type, profile_url },
        source: "canonical_social",
        confidence:
          row.verification_status === "verified" || row.verification_status === "operator_verified"
            ? Math.max(base, 0.9)
            : base,
        provider_name: "company_profiles",
        discovery_source: `canonical_social:${profile_type}`,
        evidence: [
          {
            evidence_type: "social_profile",
            source_record_id: typeof row.id === "string" ? row.id : null,
            extraction_method: "company_profiles",
            evidence_text: profile_url,
            confidence: base,
            metadata: { profile_type },
          },
        ],
      }),
    )
  }

  return drafts
}

export async function collectCanonicalSnapshotIntelligenceFindings(
  admin: SupabaseClient,
  ctx: CompanyIntelligenceContext,
): Promise<GrowthCompanyIntelligenceDraftFinding[]> {
  const { data: snapshots } = await admin
    .schema("growth")
    .from("company_intelligence_snapshots")
    .select(
      "id, intelligence_category, intelligence_key, value_text, value_json, confidence, verification_status",
    )
    .eq("company_id", ctx.company_id)
    .neq("verification_status", "superseded")
    .limit(100)

  const base = baseConfidenceForCompanyIntelligenceSource("canonical_snapshot")
  const drafts: GrowthCompanyIntelligenceDraftFinding[] = []

  for (const row of snapshots ?? []) {
    const category = row.intelligence_category as GrowthCompanyIntelligenceDraftFinding["intelligence_category"]
    const key = typeof row.intelligence_key === "string" ? row.intelligence_key : ""
    const value_text = normalizeIntelligenceValueText(row.value_text)
    if (!key || !value_text) continue
    drafts.push(
      draftFinding({
        intelligence_category: category,
        intelligence_key: key,
        value_text,
        value_json:
          row.value_json && typeof row.value_json === "object"
            ? (row.value_json as Record<string, unknown>)
            : null,
        source: "canonical_snapshot",
        confidence: typeof row.confidence === "number" ? row.confidence : base,
        provider_name: "company_intelligence_snapshots",
        discovery_source: "prior_snapshot",
        evidence: [
          {
            evidence_type: "canonical_snapshot",
            source_record_id: typeof row.id === "string" ? row.id : null,
            extraction_method: "company_intelligence_snapshots",
            evidence_text: value_text,
            confidence: base,
          },
        ],
      }),
    )
  }

  return drafts
}

const WEBSITE_PATHS = ["/", "/about", "/contact", ...CAREERS_CRAWL_PATHS]

export async function collectWebsiteCompanyIntelligenceFindings(
  ctx: CompanyIntelligenceContext,
): Promise<{ drafts: GrowthCompanyIntelligenceDraftFinding[]; messages: string[] }> {
  const messages: string[] = []
  const website = ctx.website_url?.trim() || (ctx.primary_domain ? `https://${ctx.primary_domain}` : null)
  if (!website) {
    messages.push("Website source skipped: no website URL or primary domain.")
    return { drafts: [], messages }
  }

  const ready = resolveReadyLeadWebsiteUrl(website)
  if (!ready) {
    messages.push("Website source skipped: URL not ready for crawl.")
    return { drafts: [], messages }
  }

  const origin = new URL(ready).origin
  const paths = [...new Set([ready, ...WEBSITE_PATHS.map((p) => `${origin}${p}`)])]
  const drafts: GrowthCompanyIntelligenceDraftFinding[] = []
  const base = baseConfidenceForCompanyIntelligenceSource("website")

  for (const pageUrl of paths) {
    const fetch = await fetchLeadWebsite(pageUrl)
    if (fetch.status !== "ok" || !fetch.excerpt) {
      messages.push(`${pageUrl}: ${fetch.status}`)
      continue
    }
    const html = fetch.excerpt
    const plainText = html.replace(/<[^>]+>/g, " ")

    const metaDescription = extractMetaDescriptionFromHtml(html)
    if (metaDescription) {
      drafts.push(
        draftFinding({
          intelligence_category: "description",
          intelligence_key: "meta_description",
          value_text: metaDescription,
          value_json: null,
          source: "website",
          confidence: 0.9,
          provider_name: "public_website",
          discovery_source: "meta_description",
          evidence: [
            {
              evidence_type: "meta_tag",
              source_url: pageUrl,
              extraction_method: "og_description_or_meta_description",
              evidence_text: metaDescription.slice(0, 240),
              confidence: 0.9,
            },
          ],
        }),
      )
    }

    for (const org of extractSchemaOrgOrganizationsFromHtml(html)) {
      if (org.description) {
        drafts.push(
          draftFinding({
            intelligence_category: "description",
            intelligence_key: "schema_org_description",
            value_text: org.description,
            value_json: null,
            source: "website",
            confidence: 0.92,
            provider_name: "public_website",
            discovery_source: "schema_org",
            evidence: [
              {
                evidence_type: "schema_org",
                source_url: pageUrl,
                extraction_method: "json_ld_organization",
                evidence_text: org.description.slice(0, 240),
                confidence: 0.92,
              },
            ],
          }),
        )
      }
      if (org.industry) {
        drafts.push(
          draftFinding({
            intelligence_category: "industry",
            intelligence_key: "schema_org_industry",
            value_text: org.industry,
            value_json: null,
            source: "website",
            confidence: 0.9,
            provider_name: "public_website",
            discovery_source: "schema_org",
            evidence: [
              {
                evidence_type: "schema_org",
                source_url: pageUrl,
                extraction_method: "json_ld_organization.industry",
                evidence_text: org.industry,
                confidence: 0.9,
              },
            ],
          }),
        )
      }
      if (org.numberOfEmployees) {
        drafts.push(
          draftFinding({
            intelligence_category: "company_size",
            intelligence_key: "schema_org_employees",
            value_text: org.numberOfEmployees,
            value_json: null,
            source: "website",
            confidence: 0.88,
            provider_name: "public_website",
            discovery_source: "schema_org",
            evidence: [
              {
                evidence_type: "schema_org",
                source_url: pageUrl,
                extraction_method: "json_ld_organization.numberOfEmployees",
                evidence_text: org.numberOfEmployees,
                confidence: 0.88,
              },
            ],
          }),
        )
      }
      const locality = [org.addressLocality, org.addressRegion, org.addressCountry].filter(Boolean).join(", ")
      if (locality) {
        drafts.push(
          draftFinding({
            intelligence_category: "location",
            intelligence_key: "schema_org_address",
            value_text: locality,
            value_json: {
              city: org.addressLocality,
              state: org.addressRegion,
              country: org.addressCountry,
            },
            source: "website",
            confidence: 0.88,
            provider_name: "public_website",
            discovery_source: "schema_org",
            evidence: [
              {
                evidence_type: "schema_org",
                source_url: pageUrl,
                extraction_method: "json_ld_organization.address",
                evidence_text: locality,
                confidence: 0.88,
              },
            ],
          }),
        )
      }
    }

    const techDetect = detectWebsiteTechnologies(html, plainText)
    for (const tech of techDetect.technologies) {
      drafts.push(
        draftFinding({
          intelligence_category: "technology",
          intelligence_key: normalizeTechnologyIntelligenceKey(tech),
          value_text: tech,
          value_json: { technology: tech },
          source: "website",
          confidence: 0.9,
          provider_name: "public_website",
          discovery_source: "technology_pattern",
          evidence: [
            {
              evidence_type: "pattern_match",
              source_url: pageUrl,
              extraction_method: "detectWebsiteTechnologies",
              evidence_text: tech,
              confidence: 0.9,
            },
          ],
        }),
      )
    }

    const stack = detectTechStackSignals({ pageUrl, html, plainText })
    for (const ev of stack.evidence) {
      const techName =
        typeof ev.metadata?.technology === "string" ? ev.metadata.technology : ev.evidence_excerpt.slice(0, 80)
      if (!techName) continue
      drafts.push(
        draftFinding({
          intelligence_category: "technology",
          intelligence_key: normalizeTechnologyIntelligenceKey(techName),
          value_text: techName,
          value_json: { technology: techName },
          source: "website",
          confidence: 0.88,
          provider_name: "public_website",
          discovery_source: "tech_stack_signal",
          evidence: [
            {
              evidence_type: "pattern_match",
              source_url: pageUrl,
              extraction_method: "detectTechStackSignals",
              evidence_text: ev.evidence_excerpt,
              confidence: 0.88,
              metadata: ev.metadata ?? {},
            },
          ],
        }),
      )
    }

    const careers = detectCareersPageEvidence({ pageUrl, html, plainText })
    if (careers.evidence.length > 0) {
      const excerpt = careers.evidence[0]?.evidence_excerpt ?? "Careers page observed"
      drafts.push(
        draftFinding({
          intelligence_category: "hiring",
          intelligence_key: "careers_page",
          value_text: "present",
          value_json: { signal: "careers_page" },
          source: "website",
          confidence: 0.9,
          provider_name: "public_website",
          discovery_source: "careers_hiring_detector",
          evidence: careers.evidence.slice(0, 3).map((e) => ({
            evidence_type: "website_page" as const,
            source_url: pageUrl,
            extraction_method: "detectCareersPageEvidence",
            evidence_text: e.evidence_excerpt,
            confidence: 0.9,
          })),
        }),
      )
    }
    for (const signal of careers.signals.slice(0, 5)) {
      drafts.push(
        draftFinding({
          intelligence_category: "hiring",
          intelligence_key: normalizeWebsiteSignalKey(signal.signal_type),
          value_text: signal.evidence_excerpt.slice(0, 120),
          value_json: { signal_type: signal.signal_type },
          source: "website",
          confidence: 0.86,
          provider_name: "public_website",
          discovery_source: "careers_hiring_detector",
          evidence: [
            {
              evidence_type: "pattern_match",
              source_url: pageUrl,
              extraction_method: "hiring_signal",
              evidence_text: signal.evidence_excerpt,
              confidence: 0.86,
              metadata: signal.metadata ?? {},
            },
          ],
        }),
      )
    }

    const flags = detectWebsiteFeatureFlags(html, plainText, {
      url: pageUrl,
      fetchStatus: "ok",
      title: null,
      metaDescription: metaDescription,
      services: [],
      serviceAreas: [],
      contactMethods: [],
      plainText,
      html,
      hasSsl: pageUrl.startsWith("https"),
      hasMobileViewport: /viewport/i.test(html),
    })
    const signalMap: Array<[string, boolean, string]> = [
      ["has_social_links", flags.hasSocialLinks, "Social profile links on public website"],
      ["has_review_links", flags.hasReviewLinks, "Review directory links on public website"],
      ["has_online_booking", flags.hasOnlineBooking, "Online booking language on public website"],
      ["has_customer_portal", flags.hasCustomerPortal, "Customer portal language on public website"],
      ["has_chat_widget", flags.hasChatWidget, "Live chat widget indicators on public website"],
    ]
    for (const [key, present, label] of signalMap) {
      if (!present) continue
      drafts.push(
        draftFinding({
          intelligence_category: "website_signal",
          intelligence_key: normalizeWebsiteSignalKey(key),
          value_text: "true",
          value_json: { signal: key },
          source: "website",
          confidence: 0.87,
          provider_name: "public_website",
          discovery_source: "website_feature_flags",
          evidence: [
            {
              evidence_type: "website_structured",
              source_url: pageUrl,
              extraction_method: "detectWebsiteFeatureFlags",
              evidence_text: label,
              confidence: 0.87,
            },
          ],
        }),
      )
    }

    const employeeMatch = plainText.match(/(\d{1,4})\+?\s*(employees|technicians|team members)/i)
    if (employeeMatch) {
      const value = `${employeeMatch[1]}+ ${employeeMatch[2]}`
      drafts.push(
        draftFinding({
          intelligence_category: "company_size",
          intelligence_key: "website_employee_mention",
          value_text: value,
          value_json: null,
          source: "website",
          confidence: 0.82,
          provider_name: "public_website",
          discovery_source: "plain_text_pattern",
          evidence: [
            {
              evidence_type: "pattern_match",
              source_url: pageUrl,
              extraction_method: "employee_size_regex",
              evidence_text: value,
              confidence: 0.82,
            },
          ],
        }),
      )
    }
  }

  try {
    const contactDiscovery = await discoverWebsiteContacts(ready)
    const companyEmails = contactDiscovery.contacts
      .map((c) => c.email?.trim())
      .filter((e): e is string => Boolean(e))
    const companyPhones = contactDiscovery.contacts
      .map((c) => c.phone?.trim())
      .filter((p): p is string => Boolean(p))

    if (companyEmails.length > 0) {
      drafts.push(
        draftFinding({
          intelligence_category: "contactability",
          intelligence_key: "public_email",
          value_text: companyEmails[0]!,
          value_json: { emails_observed: companyEmails.slice(0, 5) },
          source: "website",
          confidence: 0.9,
          provider_name: "public_website",
          discovery_source: "website_contact_discovery",
          evidence: [
            {
              evidence_type: "website_structured",
              source_url: ready,
              extraction_method: "discoverWebsiteContacts",
              evidence_text: `public email: ${companyEmails[0]}`,
              confidence: 0.9,
            },
          ],
        }),
      )
    }
    if (companyPhones.length > 0) {
      drafts.push(
        draftFinding({
          intelligence_category: "contactability",
          intelligence_key: "public_phone",
          value_text: companyPhones[0]!,
          value_json: { phones_observed: companyPhones.slice(0, 5) },
          source: "website",
          confidence: 0.88,
          provider_name: "public_website",
          discovery_source: "website_contact_discovery",
          evidence: [
            {
              evidence_type: "website_structured",
              source_url: ready,
              extraction_method: "discoverWebsiteContacts",
              evidence_text: `public phone: ${companyPhones[0]}`,
              confidence: 0.88,
            },
          ],
        }),
      )
    }
  } catch (e) {
    messages.push(`Contactability crawl: ${e instanceof Error ? e.message : "failed"}`)
  }

  return { drafts: dedupeFindings(drafts), messages }
}

export async function collectAllCompanyIntelligenceFindings(
  admin: SupabaseClient,
  ctx: CompanyIntelligenceContext,
): Promise<{ drafts: GrowthCompanyIntelligenceDraftFinding[]; messages: string[] }> {
  const messages: string[] = []
  const { collectPdlCompanyIntelligenceFindings } = await import(
    "@/lib/growth/providers/pdl/pdl-company-intelligence-source"
  )
  const results = await Promise.all([
    Promise.resolve(collectCanonicalCompanyIntelligenceFindings(ctx)),
    collectStagingCompanyIntelligenceFindings(admin, ctx),
    collectCanonicalSocialIntelligenceFindings(admin, ctx),
    collectCanonicalSnapshotIntelligenceFindings(admin, ctx),
    collectWebsiteCompanyIntelligenceFindings(ctx),
    collectPdlCompanyIntelligenceFindings(ctx),
  ])

  const canonical = results[0] as GrowthCompanyIntelligenceDraftFinding[]
  const staging = results[1] as { drafts: GrowthCompanyIntelligenceDraftFinding[]; messages: string[] }
  const social = results[2] as GrowthCompanyIntelligenceDraftFinding[]
  const snapshots = results[3] as GrowthCompanyIntelligenceDraftFinding[]
  const website = results[4] as { drafts: GrowthCompanyIntelligenceDraftFinding[]; messages: string[] }
  const pdl = results[5] as { drafts: GrowthCompanyIntelligenceDraftFinding[]; messages: string[] }

  messages.push(...staging.messages, ...website.messages, ...pdl.messages)

  return {
    drafts: dedupeFindings([
      ...canonical,
      ...staging.drafts,
      ...social,
      ...snapshots,
      ...website.drafts,
      ...pdl.drafts,
    ]),
    messages,
  }
}
