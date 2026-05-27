import type { GrowthSignalProvider } from "@/lib/growth/signals/providers/signal-provider-types"
import {
  buildPersonSignalDedupeKey,
  buildPersonSignalEvidenceSummary,
  GROWTH_JOB_CHANGE_MANUAL_QUEUE_SAMPLE_INPUT,
  normalizeJobChangeManualFields,
  parseJobChangeManualItem,
  type PersonSignalTransitionType,
} from "@/lib/growth/signals/job-change-signal-normalizer"
import {
  evaluatePersonIdentityConfidence,
  meetsPromotionIdentityThreshold,
} from "@/lib/growth/signals/person-identity-confidence"
import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalEvidenceDraft,
} from "@/lib/growth/signals/signal-types"

export const GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY = "job_change_manual" as const

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === "object") return [raw]
  return []
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function hasWeakEvidenceLanguage(excerpt: string): boolean {
  return /\b(maybe|possibly|might have|appears to have|rumored|unclear)\b/i.test(excerpt)
}

function hasPromotionLanguage(excerpt: string): boolean {
  return /\b(promot(ed|ion)|internal promotion|title change)\b/i.test(excerpt)
}

function buildPersonMetadata(input: {
  personName: string
  personExternalId: string | null
  identityConfidence: number
  confidenceReason: string
  requiredReview: boolean
  previousCompanyName: string
  previousCompanyDomain: string | null
  newCompanyName: string
  newCompanyDomain: string | null
  previousTitle: string | null
  newTitle: string
  transitionType: PersonSignalTransitionType
  seniorityDelta: number
  sourceUrl: string | null
  sourceLabel: string | null
  department: string
}) {
  return {
    person_signal: true,
    person_name: input.personName,
    person_external_id: input.personExternalId,
    identity_confidence: input.identityConfidence,
    identity_confidence_reason: input.confidenceReason,
    required_review: input.requiredReview,
    previous_company_name: input.previousCompanyName || null,
    previous_company_domain: input.previousCompanyDomain,
    new_company_name: input.newCompanyName || null,
    new_company_domain: input.newCompanyDomain,
    previous_title: input.previousTitle,
    new_title: input.newTitle,
    transition_type: input.transitionType,
    same_company_transition:
      input.transitionType === "internal_promotion" || input.transitionType === "title_change",
    seniority_delta: input.seniorityDelta,
    evidence_urls: input.sourceUrl ? [input.sourceUrl] : [],
    source_label: input.sourceLabel,
    no_autonomous_outreach: true,
    people_provider: GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
    department: input.department,
  }
}

function buildDraft(input: {
  signal_type: "job_change" | "promotion"
  fields: ReturnType<typeof normalizeJobChangeManualFields>
  identity: ReturnType<typeof evaluatePersonIdentityConfidence>
  transitionType: PersonSignalTransitionType
}): GrowthNormalizedSignalDraft {
  const { fields, identity, transitionType } = input
  const evidence: GrowthSignalEvidenceDraft[] = [
    {
      source_type: "manual",
      source_label: fields.sourceLabel ?? GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
      source_url: fields.sourceUrl,
      publisher: fields.sourceLabel,
      excerpt: fields.excerpt || buildPersonSignalEvidenceSummary({
        person_name: fields.personName,
        transition_type: transitionType,
        previous_title: fields.previousTitle,
        new_title: fields.newTitle,
        previous_company_name: fields.previousCompanyName,
        new_company_name: fields.newCompanyName,
        excerpt: fields.excerpt,
      }),
      observed_at: fields.occurredAt,
      confidence_score: identity.identity_confidence,
    },
  ]

  const metadata = buildPersonMetadata({
    personName: fields.personName,
    personExternalId: fields.personExternalId,
    identityConfidence: identity.identity_confidence,
    confidenceReason: identity.confidence_reason,
    requiredReview: identity.required_review,
    previousCompanyName: fields.previousCompanyName,
    previousCompanyDomain: fields.previousCompanyDomain,
    newCompanyName: fields.newCompanyName,
    newCompanyDomain: fields.newCompanyDomain,
    previousTitle: fields.previousTitle,
    newTitle: fields.newTitle,
    transitionType,
    seniorityDelta: fields.seniorityDelta,
    sourceUrl: fields.sourceUrl,
    sourceLabel: fields.sourceLabel,
    department: fields.department,
  })

  const providerEventId =
    fields.providerEventId ??
    buildPersonSignalDedupeKey({
      person_external_id: fields.personExternalId,
      person_name: fields.personName,
      source_url: fields.sourceUrl,
      new_company_domain: fields.newCompanyDomain,
      new_company_name: fields.newCompanyName,
      new_title: fields.newTitle,
      occurred_at: fields.occurredAt,
      signal_type: input.signal_type,
    })

  return {
    signal_type: input.signal_type,
    provider_key: GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
    provider_event_id: providerEventId,
    occurred_at: fields.occurredAt,
    company_name: fields.newCompanyName,
    domain: fields.newCompanyDomain,
    contact_display_label: fields.personName,
    title: fields.newTitle,
    previous_title: fields.previousTitle,
    seniority: fields.seniority,
    category: fields.department,
    evidence,
    targets: fields.personExternalId
      ? [
          {
            target_kind: "contact",
            target_ref: fields.personExternalId,
            target_label: fields.personName,
          },
        ]
      : undefined,
    metadata,
    raw_payload: {
      person_name: fields.personName,
      person_external_id: fields.personExternalId,
      source_url: fields.sourceUrl,
      transition_type: transitionType,
    },
  }
}

export function normalizeJobChangeManualItems(raw: unknown): GrowthNormalizedSignalDraft[] {
  const drafts: GrowthNormalizedSignalDraft[] = []

  for (const entry of asArray(raw)) {
    const parsed = parseJobChangeManualItem(entry)
    if (!parsed) continue

    const fields = normalizeJobChangeManualFields(parsed)
    if (!fields.personName) continue
    if (!fields.newTitle) continue
    if (!fields.newCompanyName && !fields.newCompanyDomain) continue
    if (!fields.excerpt && !fields.sourceUrl && !fields.personExternalId) continue
    if (fields.excerpt && hasWeakEvidenceLanguage(fields.excerpt)) continue
    if (fields.sourceUrl && !isHttpUrl(fields.sourceUrl) && !fields.personExternalId) continue
    if (
      !fields.previousTitle &&
      (parsed.explicit_promotion === true ||
        hasPromotionLanguage(fields.excerpt) ||
        fields.transitionType === "internal_promotion")
    ) {
      continue
    }

    const identity = evaluatePersonIdentityConfidence({
      person_name: fields.personName,
      person_external_id: fields.personExternalId,
      source_url: fields.sourceUrl,
      source_label: fields.sourceLabel,
      excerpt: fields.excerpt,
      new_company_name: fields.newCompanyName,
      new_company_domain: fields.newCompanyDomain,
      new_title: fields.newTitle,
      occurred_at: fields.occurredAt,
    })
    if (!identity.accept) continue

    const transitionType = fields.transitionType

    const shouldCreatePromotion =
      (transitionType === "internal_promotion" || parsed.explicit_promotion === true) &&
      Boolean(fields.previousTitle) &&
      fields.seniorityDelta > 0 &&
      meetsPromotionIdentityThreshold(identity.identity_confidence) &&
      (fields.previousCompanyDomain === fields.newCompanyDomain ||
        (fields.previousCompanyName &&
          fields.newCompanyName &&
          fields.previousCompanyName.toLowerCase() === fields.newCompanyName.toLowerCase()))

    if (transitionType === "company_move") {
      drafts.push(
        buildDraft({
          signal_type: "job_change",
          fields,
          identity,
          transitionType: "company_move",
        }),
      )
      continue
    }

    if (shouldCreatePromotion) {
      drafts.push(
        buildDraft({
          signal_type: "promotion",
          fields,
          identity,
          transitionType: "internal_promotion",
        }),
      )
      continue
    }

    drafts.push(
      buildDraft({
        signal_type: "job_change",
        fields,
        identity,
        transitionType,
      }),
    )
  }

  return drafts
}

export function createJobChangeManualSignalAdapter(): GrowthSignalProvider {
  return {
    provider_key: GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
    display_name: "Job changes (manual input)",
    status: "active",
    supported_signal_types: ["job_change", "promotion"],
    isConfigured() {
      return true
    },
    normalize(raw: unknown): GrowthNormalizedSignalDraft[] {
      return normalizeJobChangeManualItems(raw)
    },
    extractEvidence(raw: unknown): GrowthSignalEvidenceDraft[] {
      return this.normalize(raw).flatMap((draft) => draft.evidence)
    },
    computeProviderConfidence(draft: GrowthNormalizedSignalDraft): number {
      const meta = draft.metadata ?? {}
      const identity =
        typeof meta.identity_confidence === "number" ? meta.identity_confidence : draft.evidence[0]?.confidence_score
      return typeof identity === "number" ? identity : 0.5
    },
    async poll(context) {
      const sample =
        context.sample_input ??
        (context.cursor && typeof context.cursor === "object"
          ? (context.cursor as Record<string, unknown>).sample_input
          : undefined)

      if (!sample) {
        return {
          ok: true,
          status: "skipped",
          provider_key: GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
          drafts: [],
          message:
            "job_change_manual requires cursor.sample_input with one or more verified person employment change items.",
        }
      }

      const drafts = this.normalize(sample)
      if (drafts.length === 0) {
        return {
          ok: false,
          status: "failed",
          provider_key: GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
          drafts: [],
          message:
            "No valid person signals — each item requires person_name, evidence, company, title, and identity confidence >= 0.5.",
        }
      }

      return {
        ok: true,
        status: "completed",
        provider_key: GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
        drafts,
      }
    },
  }
}

export { GROWTH_JOB_CHANGE_MANUAL_QUEUE_SAMPLE_INPUT }
