import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthBrowserIntakeBuyingCommitteeCandidate,
  GrowthBrowserIntakeBuyingCommitteeCandidateInput,
  GrowthBrowserIntakeBuyingCommitteeDiscoveryResult,
} from "@/lib/growth/browser-intake/browser-intake-buying-committee-types"
import {
  findBrowserIntakeExistingLeads,
  pickBestBrowserIntakeLeadMatch,
} from "@/lib/growth/browser-intake/browser-intake-lead-lookup"
import { detectLinkedInPageKind } from "@/lib/growth/browser-intake/linkedin-context-detect"
import {
  listBrowserIntakeBuyingCommitteeTargetRoles,
  scoreBrowserIntakeBuyingCommitteeCandidate,
} from "@/lib/growth/browser-intake/match-browser-intake-buying-committee-role"
import { loadContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-repository"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { normalizeCompanyName, normalizeWebsiteDomain } from "@/lib/growth/import/normalize"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  type GrowthLeadEnginePipelineRun,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function candidateId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)
}

function isPipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

function normalizeLinkedIn(value: string | null | undefined): string | null {
  const raw = asString(value)
  if (!raw) return null
  return raw.split("?")[0]?.replace(/\/+$/, "") ?? raw
}

function dedupeKey(input: {
  full_name: string
  linkedin_url?: string | null
  email?: string | null
}): string {
  const linkedin = normalizeLinkedIn(input.linkedin_url)
  if (linkedin) return `linkedin:${linkedin.toLowerCase()}`
  const email = asString(input.email).toLowerCase()
  if (email) return `email:${email}`
  return `name:${input.full_name.trim().toLowerCase()}`
}

function toCandidate(
  input: GrowthBrowserIntakeBuyingCommitteeCandidateInput,
  alreadyImported: boolean,
): GrowthBrowserIntakeBuyingCommitteeCandidate {
  const scored = scoreBrowserIntakeBuyingCommitteeCandidate({
    job_title: input.job_title,
    full_name: input.full_name,
    sourceConfidence: input.confidence / 100,
  })

  return {
    ...input,
    target_role: input.target_role ?? scored.matched_target_role,
    confidence: Math.max(input.confidence, scored.confidence),
    matched_target_role: scored.matched_target_role,
    already_imported: alreadyImported,
  }
}

async function resolveAnchorLeadId(
  admin: SupabaseClient,
  input: {
    lead_id?: string | null
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
  },
): Promise<{ leadId: string | null; companyName: string }> {
  if (input.lead_id) {
    const lead = await fetchGrowthLeadById(admin, input.lead_id)
    if (lead) return { leadId: lead.id, companyName: lead.companyName }
  }

  const matches = await findBrowserIntakeExistingLeads(admin, {
    company_name: input.company_name,
    website: input.website,
    linkedin_url: input.linkedin_url,
    limit: 5,
  })
  const best = pickBestBrowserIntakeLeadMatch(matches)
  if (best && best.confidence >= 0.7) {
    return { leadId: best.lead_id, companyName: best.company_name }
  }

  return { leadId: null, companyName: asString(input.company_name) }
}

async function loadRelatedContactCandidates(
  admin: SupabaseClient,
  anchorLeadId: string | null,
  companyName: string,
  website: string | null,
): Promise<GrowthBrowserIntakeBuyingCommitteeCandidateInput[]> {
  if (!anchorLeadId) return []

  const anchor = await fetchGrowthLeadById(admin, anchorLeadId)
  if (!anchor) return []

  const companyKey = normalizeCompanyName(companyName || anchor.companyName)
  const domain = normalizeWebsiteDomain(website ?? anchor.website)

  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, contact_name, contact_email, contact_phone, website, status, metadata")
    .neq("id", anchorLeadId)
    .limit(300)

  const out: GrowthBrowserIntakeBuyingCommitteeCandidateInput[] = []
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    const rowCompany = normalizeCompanyName(asString(record.company_name))
    const rowDomain = normalizeWebsiteDomain(asString(record.website))
    const sameCompany =
      (companyKey && rowCompany === companyKey) || (domain && rowDomain && rowDomain === domain)
    if (!sameCompany) continue

    const contactName = asString(record.contact_name)
    if (!contactName) continue

    const metadata = record.metadata
    const importMeta =
      metadata && typeof metadata === "object"
        ? ((metadata as Record<string, unknown>).import as Record<string, unknown> | undefined)
        : undefined
    const linkedinFromMeta = asString(importMeta?.linkedin)

    out.push({
      candidate_id: candidateId(["related_lead", asString(record.id), contactName]),
      full_name: contactName,
      job_title: null,
      linkedin_url: linkedinFromMeta || null,
      email: asString(record.contact_email) || null,
      phone: asString(record.contact_phone) || null,
      source: "related_company_lead",
      confidence: 72,
      evidence: `Related lead at ${asString(record.company_name)}`,
    })
  }

  return out
}

export async function discoverBrowserIntakeBuyingCommittee(
  admin: SupabaseClient,
  input: {
    lead_id?: string | null
    company_name?: string | null
    website?: string | null
    linkedin_url?: string | null
    source_url?: string | null
    visible_candidates?: Array<{
      full_name: string
      job_title?: string | null
      linkedin_url?: string | null
      email?: string | null
      phone?: string | null
      source?: string | null
    }>
  },
): Promise<GrowthBrowserIntakeBuyingCommitteeDiscoveryResult> {
  const companyName = asString(input.company_name)
  if (!companyName && !input.lead_id) {
    throw new Error("company_name_required")
  }

  const { leadId, companyName: resolvedCompany } = await resolveAnchorLeadId(admin, input)
  const anchorLead = leadId ? await fetchGrowthLeadById(admin, leadId) : null
  const displayCompany = resolvedCompany || anchorLead?.companyName || companyName

  const importedKeys = new Set<string>()
  const rawCandidates: GrowthBrowserIntakeBuyingCommitteeCandidateInput[] = []

  if (leadId) {
    const decisionMakers = await listGrowthLeadDecisionMakers(admin, leadId)
    for (const dm of decisionMakers) {
      importedKeys.add(
        dedupeKey({ full_name: dm.fullName, linkedin_url: dm.linkedinUrl, email: dm.email }),
      )
      rawCandidates.push({
        candidate_id: candidateId(["decision_maker", dm.id]),
        full_name: dm.fullName,
        job_title: dm.title,
        linkedin_url: dm.linkedinUrl,
        email: dm.email,
        phone: dm.phone,
        source: `decision_maker:${dm.source}`,
        confidence: Math.round((dm.confidence ?? 0.75) * 100),
        evidence: dm.evidenceExcerpt,
      })
    }

    const metadata = anchorLead?.metadata ?? {}
    const companyCandidateId = asString(
      (metadata.contact_discovery_queue as Record<string, unknown> | undefined)?.company_candidate_id,
    )
    if (companyCandidateId) {
      const snapshot = await loadContactDiscoverySnapshot(admin, companyCandidateId)
      for (const contact of snapshot?.contacts ?? []) {
        rawCandidates.push({
          candidate_id: candidateId(["contact_discovery", contact.id]),
          full_name: contact.full_name,
          job_title: contact.job_title,
          linkedin_url: contact.linkedin_url,
          email: contact.email,
          phone: contact.phone,
          source: `contact_discovery:${contact.provider_name}`,
          confidence: Math.round(contact.confidence * 100),
          evidence: contact.evidence?.[0]?.evidence ?? contact.source_attribution?.[0]?.evidence,
        })
      }
    }

    const runRaw = metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
    const leadEngineRun = isPipelineRun(runRaw) ? runRaw : null
    const outputs = leadEngineRun ? extractLeadEngineOutputsFromRun(leadEngineRun) : {}
    const hypothesis = outputs.decisionMakerHypothesis
    if (hypothesis) {
      for (const target of [
        ...hypothesis.buying_committee.primary_targets,
        ...hypothesis.buying_committee.secondary_targets,
      ]) {
        rawCandidates.push({
          candidate_id: candidateId(["hypothesis", target.role]),
          full_name: target.role,
          job_title: target.role,
          target_role: target.role,
          source: "lead_engine_hypothesis",
          confidence: Math.round(target.confidence * 100),
          evidence: target.reason,
        })
      }
    }
  }

  for (const visible of input.visible_candidates ?? []) {
    const fullName = asString(visible.full_name)
    if (!fullName) continue
    rawCandidates.push({
      candidate_id: candidateId(["visible", fullName, visible.linkedin_url ?? ""]),
      full_name: fullName,
      job_title: visible.job_title ?? null,
      linkedin_url: visible.linkedin_url ?? null,
      email: visible.email ?? null,
      phone: visible.phone ?? null,
      source: visible.source ?? "linkedin_visible_page",
      confidence: 68,
      evidence: "Visible on current LinkedIn company page",
    })
  }

  rawCandidates.push(
    ...(await loadRelatedContactCandidates(
      admin,
      leadId,
      displayCompany,
      input.website ?? anchorLead?.website ?? null,
    )),
  )

  const map = new Map<string, GrowthBrowserIntakeBuyingCommitteeCandidateInput>()
  for (const candidate of rawCandidates) {
    const key = dedupeKey(candidate)
    const existing = map.get(key)
    if (!existing || candidate.confidence > existing.confidence) {
      map.set(key, candidate)
    }
  }

  const candidates = [...map.values()]
    .map((candidate) =>
      toCandidate(candidate, importedKeys.has(dedupeKey(candidate))),
    )
    .sort((a, b) => b.confidence - a.confidence)

  const targetRoles = listBrowserIntakeBuyingCommitteeTargetRoles()
  const prioritized = [
    ...candidates.filter((c) => c.matched_target_role),
    ...candidates.filter((c) => !c.matched_target_role),
  ]

  return {
    company_name: displayCompany,
    lead_id: leadId,
    linkedin_page_kind: detectLinkedInPageKind(input.source_url ?? input.linkedin_url),
    candidates: prioritized,
    target_roles: targetRoles,
  }
}
