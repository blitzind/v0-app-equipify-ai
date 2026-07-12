/**
 * GE-AIOS-CONTACT-1A — Persist DataMoon contacts into canonical person/email/phone (server-only).
 * Reuses resolveCanonicalPerson + integrity-gated upserts. Never fabricates contacts.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildCanonicalPersonInsertPayload,
  insertCanonicalPerson,
  resolveCanonicalCompanyIdForLead,
  touchCanonicalPersonSeen,
  upsertCanonicalPersonEmail,
  upsertCanonicalPersonLineage,
  upsertCanonicalPersonPhone,
  upsertCanonicalPersonProfile,
  upsertCanonicalPersonCompanyRole,
} from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import {
  createEmptyCanonicalPersonResolverIndexes,
  registerNewCanonicalPersonFromCandidate,
  resolveCanonicalPerson,
} from "@/lib/growth/canonical-persons/canonical-person-resolver"
import type { GrowthCanonicalPersonCandidateInput } from "@/lib/growth/canonical-persons/canonical-person-types"
import { canonicalNormalizedPersonLinkedIn } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import {
  GROWTH_AIOS_CONTACT_1A_QA_MARKER,
  projectContactChannelReadiness,
  type AiOsContactChannelReadiness,
  type DatamoonNormalizedEmailChannel,
  type DatamoonNormalizedPhoneChannel,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-contact-channels"
import type { AiOsDatamoonDmCandidate } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"
import {
  fetchCanonicalPersonEmailByNormalized,
  clearPrimaryFlagsForPersonExcept,
  evaluateCanonicalPersonEmailPromotion,
} from "@/lib/growth/email-discovery/email-discovery-person-email-integrity"
import {
  fetchCanonicalPersonPhoneByNormalized,
  clearPrimaryPhoneFlagsForPersonExcept,
  evaluateCanonicalPersonPhonePromotion,
} from "@/lib/growth/phone-discovery/phone-discovery-person-phone-integrity"
import {
  recomputeGrowthLeadDecisionMakerStatus,
  upsertGrowthLeadDecisionMakerCandidates,
  updateGrowthLeadDecisionMaker,
} from "@/lib/growth/decision-maker-repository"

export type DatamoonCanonicalContactPersistResult = {
  qaMarker: typeof GROWTH_AIOS_CONTACT_1A_QA_MARKER
  personId: string | null
  decisionMakerId: string | null
  emailsPersisted: number
  phonesPersisted: number
  emailsSkipped: number
  phonesSkipped: number
  readiness: AiOsContactChannelReadiness
  leadDecisionMakerStatus: string | null
  provenanceSource: "public_web"
  provenanceDetail: string
}

async function loadResolverIndexesForChannels(
  admin: SupabaseClient,
  input: {
    emails: DatamoonNormalizedEmailChannel[]
    phones: DatamoonNormalizedPhoneChannel[]
    linkedinUrl: string | null
    canonicalCompanyId: string | null
    fullName: string
  },
) {
  const indexes = createEmptyCanonicalPersonResolverIndexes()

  for (const email of input.emails) {
    const existing = await fetchCanonicalPersonEmailByNormalized(admin, email.normalized)
    if (existing) {
      indexes.by_normalized_email.set(email.normalized, existing.person_id)
    }
  }

  for (const phone of input.phones.filter((row) => !row.isCompanySwitchboard)) {
    const existing = await fetchCanonicalPersonPhoneByNormalized(admin, phone.normalized)
    if (existing) {
      indexes.by_normalized_phone.set(phone.normalized, existing.person_id)
    }
  }

  const linkedinKey = canonicalNormalizedPersonLinkedIn(input.linkedinUrl)
  if (linkedinKey) {
    const { data } = await admin
      .schema("growth")
      .from("person_profiles")
      .select("person_id")
      .eq("normalized_profile_key", linkedinKey)
      .eq("profile_type", "linkedin")
      .maybeSingle()
    if (data && typeof (data as { person_id?: unknown }).person_id === "string") {
      indexes.by_normalized_linkedin.set(linkedinKey, String((data as { person_id: string }).person_id))
    }
  }

  return indexes
}

async function persistEmailChannel(
  admin: SupabaseClient,
  input: {
    personId: string
    email: DatamoonNormalizedEmailChannel
    sourceId: string
    confidence: number
    observedAt: string
  },
): Promise<"persisted" | "skipped"> {
  const existing = await fetchCanonicalPersonEmailByNormalized(admin, input.email.normalized)
  // Never downgrade confidence with weaker unverified provider data.
  if (
    existing &&
    existing.person_id === input.personId &&
    existing.verification_status !== "verified" &&
    existing.confidence > input.confidence
  ) {
    return "skipped"
  }
  const ownership = evaluateCanonicalPersonEmailPromotion({
    existing,
    target_person_id: input.personId,
    incoming_confidence: input.confidence,
    incoming_verification_status: "unverified",
  })
  if (!ownership.allowed) return "skipped"

  if (input.email.emailType === "work" || !existing) {
    await clearPrimaryFlagsForPersonExcept(admin, input.personId, input.email.normalized)
  }

  await upsertCanonicalPersonEmail(admin, {
    person_id: input.personId,
    email: input.email.value,
    normalized_email: input.email.normalized,
    email_type: input.email.emailType,
    is_primary: input.email.emailType === "work" || !existing,
    verification_status: "unverified",
    confidence: input.confidence,
    source_table: "lead_decision_makers",
    source_id: input.sourceId,
    provider_name: "datamoon",
    discovery_source: "datamoon_person_enrichment",
    observed_at: input.observedAt,
    metadata: {
      ...ownership.merge_metadata,
      qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
      provider_field: input.email.fieldKey,
      raw_provider_value: input.email.rawProviderValue,
      provenance_source_column: "public_web",
      provenance_detail: `datamoon:person_enrichment:${input.sourceId}`,
    },
  })
  return "persisted"
}

async function persistPhoneChannel(
  admin: SupabaseClient,
  input: {
    personId: string
    phone: DatamoonNormalizedPhoneChannel
    sourceId: string
    confidence: number
    observedAt: string
  },
): Promise<"persisted" | "skipped"> {
  if (input.phone.isCompanySwitchboard) {
    return "skipped"
  }

  const existing = await fetchCanonicalPersonPhoneByNormalized(admin, input.phone.normalized)
  // Never downgrade confidence with weaker unverified provider data.
  if (
    existing &&
    existing.person_id === input.personId &&
    existing.verification_status !== "verified" &&
    existing.verification_status !== "operator_verified" &&
    existing.confidence > input.confidence
  ) {
    return "skipped"
  }
  const ownership = evaluateCanonicalPersonPhonePromotion({
    existing,
    target_person_id: input.personId,
    incoming_confidence: input.confidence,
    incoming_verification_status: "unverified",
  })
  if (!ownership.allowed) return "skipped"

  if (input.phone.phoneType === "direct" || input.phone.phoneType === "mobile" || !existing) {
    await clearPrimaryPhoneFlagsForPersonExcept(admin, input.personId, input.phone.normalized)
  }

  await upsertCanonicalPersonPhone(admin, {
    person_id: input.personId,
    phone: input.phone.e164 ?? input.phone.value,
    normalized_phone: input.phone.normalized,
    phone_type: input.phone.phoneType,
    is_primary: input.phone.phoneType === "direct" || input.phone.phoneType === "mobile" || !existing,
    verification_status: "unverified",
    confidence: input.confidence,
    source_table: "lead_decision_makers",
    source_id: input.sourceId,
    provider_name: "datamoon",
    discovery_source: "datamoon_person_enrichment",
    observed_at: input.observedAt,
    metadata: {
      ...ownership.merge_metadata,
      qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
      provider_field: input.phone.fieldKey,
      raw_provider_value: input.phone.rawProviderValue,
      extension: input.phone.extension,
      e164: input.phone.e164,
      is_company_switchboard: false,
      provenance_source_column: "public_web",
      provenance_detail: `datamoon:person_enrichment:${input.sourceId}`,
    },
  })
  return "persisted"
}

/**
 * Resolve/create canonical person, persist all DataMoon emails/phones, attach DM to lead.
 */
export async function persistDatamoonDecisionMakerCanonicalContacts(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    candidate: AiOsDatamoonDmCandidate
    emails: DatamoonNormalizedEmailChannel[]
    phones: DatamoonNormalizedPhoneChannel[]
    observedAt?: string
  },
): Promise<DatamoonCanonicalContactPersistResult> {
  const observedAt = input.observedAt ?? new Date().toISOString()
  const provenanceDetail = `datamoon:person_enrichment:${input.candidate.providerRecordId ?? "audience"}`
  const confidence = Math.max(0, Math.min(1, input.candidate.compositeScore / 100))

  const canonicalCompanyId = await resolveCanonicalCompanyIdForLead(admin, input.leadId)
  const indexes = await loadResolverIndexesForChannels(admin, {
    emails: input.emails,
    phones: input.phones,
    linkedinUrl: input.candidate.linkedinUrl,
    canonicalCompanyId,
    fullName: input.candidate.fullName,
  })

  const primaryEmail = input.emails.find((e) => e.emailType === "work") ?? input.emails[0] ?? null
  const primaryPersonPhone =
    input.phones.find((p) => !p.isCompanySwitchboard && (p.phoneType === "direct" || p.phoneType === "mobile")) ??
    input.phones.find((p) => !p.isCompanySwitchboard) ??
    null

  const candidateInput: GrowthCanonicalPersonCandidateInput = {
    source_table: "lead_decision_makers",
    source_id: `datamoon:${input.leadId}:${input.candidate.providerRecordId ?? "candidate"}`,
    run_id: input.candidate.providerRecordId,
    provider_name: "datamoon",
    provider_type: "enrichment",
    discovery_source: "datamoon_person_enrichment",
    lead_id: input.leadId,
    canonical_company_id: canonicalCompanyId,
    full_name: input.candidate.fullName,
    title: input.candidate.title,
    email: primaryEmail?.normalized ?? input.candidate.email,
    phone: primaryPersonPhone?.normalized ?? input.candidate.phone,
    linkedin_url: input.candidate.linkedinUrl,
    email_verification_status: "unverified",
    phone_verification_status: "unverified",
    confidence,
    observed_at: observedAt,
    source_metadata: {
      qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
      organization_id: input.organizationId,
      provenance_source_column: "public_web",
      provenance_detail: provenanceDetail,
    },
  }

  const resolution = resolveCanonicalPerson(candidateInput, indexes)
  let personId = resolution.person_id
  if (!personId) {
    const payload = buildCanonicalPersonInsertPayload(candidateInput, "new")
    personId = await insertCanonicalPerson(admin, payload)
  } else {
    await touchCanonicalPersonSeen(admin, personId, observedAt)
  }
  registerNewCanonicalPersonFromCandidate(indexes, personId, candidateInput, resolution)

  let emailsPersisted = 0
  let emailsSkipped = 0
  for (const email of input.emails) {
    try {
      const result = await persistEmailChannel(admin, {
        personId,
        email,
        sourceId: candidateInput.source_id,
        confidence: email.providerConfidence ?? confidence,
        observedAt,
      })
      if (result === "persisted") emailsPersisted += 1
      else emailsSkipped += 1
    } catch (error) {
      emailsSkipped += 1
      logGrowthEngine("datamoon_contact_email_persist_failed", {
        qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
        lead_id: input.leadId,
        message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      })
    }
  }

  let phonesPersisted = 0
  let phonesSkipped = 0
  for (const phone of input.phones) {
    try {
      const result = await persistPhoneChannel(admin, {
        personId,
        phone,
        sourceId: candidateInput.source_id,
        confidence: phone.providerConfidence ?? confidence,
        observedAt,
      })
      if (result === "persisted") phonesPersisted += 1
      else phonesSkipped += 1
    } catch (error) {
      phonesSkipped += 1
      logGrowthEngine("datamoon_contact_phone_persist_failed", {
        qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
        lead_id: input.leadId,
        message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      })
    }
  }

  const linkedinKey = canonicalNormalizedPersonLinkedIn(input.candidate.linkedinUrl)
  if (linkedinKey && input.candidate.linkedinUrl) {
    await upsertCanonicalPersonProfile(admin, {
      person_id: personId,
      profile_type: "linkedin",
      profile_url: input.candidate.linkedinUrl,
      normalized_profile_key: linkedinKey,
      confidence,
      source_table: "lead_decision_makers",
      source_id: candidateInput.source_id,
      provider_name: "datamoon",
      discovery_source: "datamoon_person_enrichment",
      observed_at: observedAt,
      metadata: { qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER },
    }).catch(() => undefined)
  }

  if (canonicalCompanyId) {
    await upsertCanonicalPersonCompanyRole(admin, {
      person_id: personId,
      company_id: canonicalCompanyId,
      title: input.candidate.title,
      department: null,
      seniority: null,
      role_type: "decision_maker",
      is_primary: true,
      confidence,
      source_table: "lead_decision_makers",
      source_id: candidateInput.source_id,
      provider_name: "datamoon",
      discovery_source: "datamoon_person_enrichment",
      observed_at: observedAt,
      metadata: { qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER },
    }).catch(() => undefined)
  }

  await upsertCanonicalPersonLineage(admin, {
    person_id: personId,
    source_table: "lead_decision_makers",
    source_id: candidateInput.source_id,
    provider_name: "datamoon",
    discovery_source: "datamoon_person_enrichment",
    confidence,
    observed_at: observedAt,
    metadata: {
      qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
      lead_id: input.leadId,
      provenance_detail: provenanceDetail,
    },
  }).catch(() => undefined)

  const readiness = projectContactChannelReadiness({
    emails: input.emails.map((email) => ({
      normalized: email.normalized,
      verificationStatus: "unverified",
    })),
    phones: input.phones.map((phone) => ({
      normalized: phone.normalized,
      verificationStatus: "unverified",
      isCompanySwitchboard: phone.isCompanySwitchboard,
    })),
    linkedinUrl: input.candidate.linkedinUrl,
  })

  const dmStatus =
    readiness.unblocksEmailDrafting || readiness.unblocksCallPackage ? "confirmed" : "suspected"

  const upserted = await upsertGrowthLeadDecisionMakerCandidates(admin, {
    leadId: input.leadId,
    candidates: [
      {
        fullName: input.candidate.fullName,
        title: input.candidate.title,
        email: primaryEmail?.normalized ?? input.candidate.email,
        phone: primaryPersonPhone?.normalized ?? input.candidate.phone,
        linkedinUrl: input.candidate.linkedinUrl,
        source: "public_web",
        sourceDetail: provenanceDetail,
        confidence,
        evidenceExcerpt: input.candidate.evidence.join(" | "),
      },
    ],
    createdBy: null,
  })

  const matched =
    upserted.find(
      (row) =>
        (primaryEmail && row.email?.toLowerCase() === primaryEmail.normalized) ||
        row.fullName.trim().toLowerCase() === input.candidate.fullName.trim().toLowerCase(),
    ) ?? upserted[0] ?? null

  if (matched) {
    await updateGrowthLeadDecisionMaker(admin, input.leadId, matched.id, {
      status: dmStatus,
      isPrimary: true,
      email: primaryEmail?.normalized ?? matched.email,
      phone: primaryPersonPhone?.normalized ?? matched.phone,
      canonicalPersonId: personId,
    }).catch(async () => {
      // Fallback without canonicalPersonId if older column patch path fails
      await updateGrowthLeadDecisionMaker(admin, input.leadId, matched.id, {
        status: dmStatus,
        isPrimary: true,
        email: primaryEmail?.normalized ?? matched.email,
        phone: primaryPersonPhone?.normalized ?? matched.phone,
      }).catch(() => undefined)
    })

    // Always attempt direct canonical_person_id write for buying-committee eligibility
    await admin
      .schema("growth")
      .from("lead_decision_makers")
      .update({ canonical_person_id: personId, status: dmStatus, is_primary: true })
      .eq("id", matched.id)
      .eq("lead_id", input.leadId)
      .then(() => undefined)
      .catch(() => undefined)
  }

  const recomputed = await recomputeGrowthLeadDecisionMakerStatus(admin, input.leadId).catch(() => null)

  // Project canonical channels onto lead contact fields for Cognitive Workspace / DF evidence reads.
  const leadPatch: Record<string, unknown> = {}
  if (primaryEmail?.normalized) leadPatch.contact_email = primaryEmail.normalized
  if (primaryPersonPhone?.normalized) leadPatch.contact_phone = primaryPersonPhone.normalized
  if (input.candidate.fullName.trim()) leadPatch.contact_name = input.candidate.fullName.trim()
  if (Object.keys(leadPatch).length > 0) {
    await admin
      .schema("growth")
      .from("leads")
      .update(leadPatch)
      .eq("id", input.leadId)
      .then(() => undefined)
      .catch(() => undefined)
  }

  logGrowthEngine("datamoon_canonical_contacts_persisted", {
    qa_marker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    person_id: personId,
    emails_persisted: emailsPersisted,
    phones_persisted: phonesPersisted,
    readiness_state: readiness.state,
    lead_dm_status: recomputed?.status ?? null,
  })

  return {
    qaMarker: GROWTH_AIOS_CONTACT_1A_QA_MARKER,
    personId,
    decisionMakerId: matched?.id ?? null,
    emailsPersisted,
    phonesPersisted,
    emailsSkipped,
    phonesSkipped,
    readiness,
    leadDecisionMakerStatus: recomputed?.status ?? null,
    provenanceSource: "public_web",
    provenanceDetail,
  }
}
