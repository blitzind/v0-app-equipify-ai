import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthRepByUserId } from "@/lib/growth/assignment/rep-roster-repository"
import type { GrowthBrowserIntakeCrmContext } from "@/lib/growth/browser-intake/browser-intake-crm-context-types"
import { formatGrowthLeadStatusLabel } from "@/lib/growth/browser-intake/browser-intake-crm-context-types"
import { enrichBrowserIntakeLookupMatch } from "@/lib/growth/browser-intake/enrich-browser-intake-lookup"
import {
  findBrowserIntakeExistingLeads,
  pickBestBrowserIntakeLeadMatch,
} from "@/lib/growth/browser-intake/browser-intake-lead-lookup"
import { buildLinkedInLookupQuery } from "@/lib/growth/browser-intake/linkedin-context-detect"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { loadEmailDiscoveryOperatorStatus } from "@/lib/growth/email-discovery/email-discovery-operator-status"
import { loadPhoneDiscoveryOperatorStatus } from "@/lib/growth/phone-discovery/phone-discovery-operator-status"
import { loadSocialProfileDiscoveryOperatorStatus } from "@/lib/growth/social-profile-discovery/social-profile-discovery-operator-status"
import { loadCompanyIntelligenceOperatorStatus } from "@/lib/growth/company-intelligence/company-intelligence-operator-status"
import { loadBuyingCommitteeIntelligenceOperatorStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { normalizeCompanyName, normalizeWebsiteDomain } from "@/lib/growth/import/normalize"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"
import type { GrowthLead } from "@/lib/growth/types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

type LeadRow = {
  id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  website: string | null
  status: string | null
  metadata: Record<string, unknown> | null
}

function resolveLastActivity(input: {
  lead: GrowthLead
  timelineSummary: string | null
  timelineAt: string | null
  opportunityLastActivityAt: string | null
}): { at: string | null; summary: string | null } {
  const candidates: Array<{ at: string; summary: string }> = []

  if (input.timelineAt) {
    candidates.push({
      at: input.timelineAt,
      summary: input.timelineSummary ?? "Timeline activity",
    })
  }
  if (input.lead.lastHumanTouchAt) {
    candidates.push({ at: input.lead.lastHumanTouchAt, summary: "Last human touch" })
  }
  if (input.lead.engagementLastActivityAt) {
    candidates.push({
      at: input.lead.engagementLastActivityAt,
      summary: input.lead.engagementSummary ?? "Engagement activity",
    })
  }
  if (input.lead.relationshipLastMeaningfulTouchAt) {
    candidates.push({
      at: input.lead.relationshipLastMeaningfulTouchAt,
      summary: input.lead.relationshipSummary ?? "Relationship touch",
    })
  }
  if (input.opportunityLastActivityAt) {
    candidates.push({
      at: input.opportunityLastActivityAt,
      summary: "Opportunity activity",
    })
  }

  if (candidates.length === 0) {
    return { at: null, summary: null }
  }

  candidates.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return candidates[0] ?? { at: null, summary: null }
}

async function countRelatedCompanyContacts(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<{
  companyContactsCount: number
  relatedLeadsCount: number
  relationshipMap: GrowthBrowserIntakeCrmContext["company_relationship_map"]
}> {
  const companyKey = normalizeCompanyName(lead.companyName)
  const domain = normalizeWebsiteDomain(lead.website)
  const decisionMakers = await listGrowthLeadDecisionMakers(admin, lead.id)

  const { data } = await growthLeadsTable(admin)
    .select("id, company_name, contact_name, contact_email, website, status, metadata")
    .neq("id", lead.id)
    .limit(300)

  const related = ((data ?? []) as LeadRow[]).filter((row) => {
    const rowCompany = normalizeCompanyName(row.company_name)
    const rowDomain = normalizeWebsiteDomain(row.website)
    if (companyKey && rowCompany && rowCompany === companyKey) return true
    if (domain && rowDomain && rowDomain === domain) return true
    return false
  })

  const contactLikeRelated = related.filter((row) => row.contact_name || row.contact_email).length
  const companyContactsCount = decisionMakers.length + contactLikeRelated

  const dmContacts = decisionMakers.map((dm) => ({
    lead_id: lead.id,
    name: dm.fullName,
    title: dm.title,
    status: dm.status,
  }))

  const relatedContacts = related
    .filter((row) => row.contact_name || row.contact_email)
    .slice(0, 8)
    .map((row) => ({
      lead_id: row.id,
      name: row.contact_name ?? row.contact_email ?? row.company_name,
      title: null,
      status: row.status,
    }))

  return {
    companyContactsCount,
    relatedLeadsCount: related.length,
    relationshipMap: {
      contacts: dmContacts,
      related_leads: relatedContacts,
    },
  }
}

function buildAdminLinks(leadId: string, companyName: string, opportunityId: string | null) {
  return {
    lead: `/admin/growth/leads/${leadId}`,
    company: `/admin/growth/leads/crm`,
    opportunity: opportunityId
      ? `/admin/growth/opportunities/pipeline?opportunityId=${encodeURIComponent(opportunityId)}`
      : `/admin/growth/leads?leadId=${encodeURIComponent(leadId)}`,
  }
}

export async function buildBrowserIntakeCrmContext(
  admin: SupabaseClient,
  leadId: string,
  appBasePath = "",
): Promise<GrowthBrowserIntakeCrmContext | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  const canonical_company_id = await resolveCanonicalCompanyIdForLead(admin, lead.id)
  const decisionMakersForDiscovery = await listGrowthLeadDecisionMakers(admin, lead.id)
  const email_discovery_contacts = []
  const phone_discovery_contacts = []
  const social_profile_discovery_contacts = []
  if (canonical_company_id) {
    for (const dm of decisionMakersForDiscovery) {
      const person_id = dm.canonicalPersonId?.trim() ?? ""
      if (!person_id) continue
      const status = await loadEmailDiscoveryOperatorStatus(admin, {
        company_id: canonical_company_id,
        person_id,
      })
      if (status) {
        email_discovery_contacts.push({
          person_id,
          name: dm.fullName,
          title: dm.title,
          verified_email: status.verified_email,
          has_verified_email: status.has_verified_email,
          discovery_status: status.discovery_status,
          can_discover: status.can_discover,
        })
      }
      const phoneStatus = await loadPhoneDiscoveryOperatorStatus(admin, {
        company_id: canonical_company_id,
        person_id,
      })
      if (phoneStatus) {
        phone_discovery_contacts.push({
          person_id,
          name: dm.fullName,
          title: dm.title,
          verified_phone: phoneStatus.verified_phone,
          has_verified_phone: phoneStatus.has_verified_phone,
          discovery_status: phoneStatus.discovery_status,
          can_discover: phoneStatus.can_discover,
        })
      }
      const socialStatus = await loadSocialProfileDiscoveryOperatorStatus(admin, {
        company_id: canonical_company_id,
        person_id,
        discovery_scope: "person",
      })
      if (socialStatus) {
        social_profile_discovery_contacts.push({
          person_id,
          name: dm.fullName,
          title: dm.title,
          verified_profile: socialStatus.verified_profile,
          has_verified_profile: socialStatus.has_verified_profile,
          discovery_status: socialStatus.discovery_status,
          can_discover: socialStatus.can_discover,
        })
      }
    }
  }

  let company_intelligence = null
  let buying_committee_intelligence = null
  if (canonical_company_id) {
    const ciStatus = await loadCompanyIntelligenceOperatorStatus(admin, {
      company_id: canonical_company_id,
    })
    if (ciStatus) {
      company_intelligence = {
        company_id: canonical_company_id,
        snapshot_count: ciStatus.snapshot_count,
        has_verified_intelligence: ciStatus.has_verified_intelligence,
        discovery_status: ciStatus.discovery_status,
        can_discover: ciStatus.can_discover,
      }
    }

    const bciStatus = await loadBuyingCommitteeIntelligenceOperatorStatus(admin, {
      company_id: canonical_company_id,
    })
    if (bciStatus) {
      buying_committee_intelligence = {
        company_id: canonical_company_id,
        verified_member_count: bciStatus.verified_member_count,
        has_verified_committee: bciStatus.has_verified_committee,
        discovery_status: bciStatus.discovery_status,
        can_discover: bciStatus.can_discover,
        coverage_score: bciStatus.coverage_score,
      }
    }
  }

  const [ownerRep, opportunity, timeline, enrichedMatch, companyCounts] = await Promise.all([
    lead.assignedTo ? fetchGrowthRepByUserId(admin, lead.assignedTo) : Promise.resolve(null),
    fetchGrowthOpportunityByLeadId(admin, lead.id),
    listGrowthLeadTimelineEvents(admin, { leadId: lead.id, limit: 5 }),
    enrichBrowserIntakeLookupMatch(admin, {
      lead_id: lead.id,
      company_name: lead.companyName,
      website: lead.website,
      contact_name: lead.contactName,
      contact_email: lead.contactEmail,
      status: lead.status,
      rule: "explicit",
      confidence: 1,
      dedupe_key: lead.id,
    }),
    countRelatedCompanyContacts(admin, lead),
  ])

  const latestTimeline = timeline[0] ?? null
  const lastActivity = resolveLastActivity({
    lead,
    timelineSummary: latestTimeline?.title ?? latestTimeline?.summary ?? null,
    timelineAt: latestTimeline?.occurredAt ?? null,
    opportunityLastActivityAt: opportunity?.lastActivityAt ?? null,
  })

  const nextActionKey = lead.nextBestAction
  const adminPrefix = appBasePath.replace(/\/$/, "")

  return {
    lead_id: lead.id,
    company_name: lead.companyName,
    contact_name: lead.contactName,
    lead_status: lead.status,
    lead_status_label: formatGrowthLeadStatusLabel(lead.status),
    owner: lead.assignedTo
      ? {
          user_id: lead.assignedTo,
          display_name: ownerRep?.displayName ?? null,
          email: ownerRep?.email ?? null,
        }
      : null,
    last_activity: lastActivity,
    next_action: {
      key: nextActionKey,
      label: nextActionKey ? GROWTH_NEXT_BEST_ACTION_LABELS[nextActionKey] : null,
      reason: lead.nextBestActionReason,
    },
    lead_score: lead.score,
    opportunity: opportunity
      ? {
          id: opportunity.id,
          stage_key: opportunity.stageKey,
          stage_label: opportunity.stageLabel,
          status_summary: opportunity.nextRequiredAction ?? opportunity.stageLabel,
          last_activity_at: opportunity.lastActivityAt,
        }
      : lead.opportunityReadinessTier
        ? {
            id: null,
            stage_key: lead.opportunityReadinessTier,
            stage_label: formatGrowthLeadStatusLabel(lead.opportunityReadinessTier),
            status_summary: lead.opportunityReadinessSummary,
            last_activity_at: lead.opportunityReadinessComputedAt,
          }
        : null,
    company_contacts_count: companyCounts.companyContactsCount,
    related_leads_count: companyCounts.relatedLeadsCount,
    status_badge: enrichedMatch.status_badge,
    status_badge_label: enrichedMatch.status_badge_label,
    match_summary: enrichedMatch.match_summary,
    lead_notes: lead.notes,
    timeline_preview: timeline.map((event) => ({
      occurred_at: event.occurredAt,
      event_type: event.eventType ?? null,
      title: event.title ?? null,
      summary: event.summary ?? null,
    })),
    company_relationship_map: companyCounts.relationshipMap,
    canonical_company_id,
    email_discovery_contacts,
    phone_discovery_contacts,
    social_profile_discovery_contacts,
    company_intelligence,
    buying_committee_intelligence,
    links: {
      lead: `${adminPrefix}${buildAdminLinks(lead.id, lead.companyName, opportunity?.id ?? null).lead}`,
      company: `${adminPrefix}${buildAdminLinks(lead.id, lead.companyName, opportunity?.id ?? null).company}`,
      opportunity: `${adminPrefix}${buildAdminLinks(lead.id, lead.companyName, opportunity?.id ?? null).opportunity}`,
    },
  }
}

export async function resolveBrowserIntakeCrmContextFromLookup(
  admin: SupabaseClient,
  input: {
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    email?: string | null
    source_url?: string | null
    lead_id?: string | null
    appBasePath?: string
  },
): Promise<{ matched: boolean; context: GrowthBrowserIntakeCrmContext | null }> {
  if (input.lead_id) {
    const context = await buildBrowserIntakeCrmContext(admin, input.lead_id, input.appBasePath)
    return { matched: Boolean(context), context }
  }

  const linkedInQuery = buildLinkedInLookupQuery({
    url: input.source_url,
    company_name: input.company_name,
    website: input.website,
    email: input.email,
    linkedin_url: input.linkedin_url,
  })

  const matches = await findBrowserIntakeExistingLeads(admin, {
    company_name: linkedInQuery.company_name,
    website: linkedInQuery.website,
    linkedin_url: linkedInQuery.linkedin_url,
    email: linkedInQuery.email,
    limit: 5,
  })
  const bestMatch = pickBestBrowserIntakeLeadMatch(matches)
  if (!bestMatch || bestMatch.confidence < 0.7) {
    return { matched: false, context: null }
  }

  const context = await buildBrowserIntakeCrmContext(admin, bestMatch.lead_id, input.appBasePath)
  if (!context) return { matched: false, context: null }

  const enriched = await enrichBrowserIntakeLookupMatch(admin, bestMatch)
  return {
    matched: true,
    context: {
      ...context,
      status_badge: enriched.status_badge,
      status_badge_label: enriched.status_badge_label,
      match_summary: enriched.match_summary,
    },
  }
}
