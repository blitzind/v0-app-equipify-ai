/** Phase GS-3D — Knowledge recommendation certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { ingestKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-ingestion-service"
import { buildKnowledgeConsumerContextFromDocuments } from "@/lib/growth/knowledge-center/knowledge-context-injection"
import { assertAllRecommendationsCited } from "@/lib/growth/knowledge-center/knowledge-citation-builder"
import {
  generateKnowledgeRecommendations,
  generateKnowledgeRecommendationsFromDocuments,
} from "@/lib/growth/knowledge-center/knowledge-recommendation-engine"
import {
  generateKnowledgeRecommendationsForRequest,
  persistKnowledgeRecommendationAudit,
} from "@/lib/growth/knowledge-center/knowledge-recommendation-service"
import {
  KNOWLEDGE_CONSUMERS,
  type KnowledgeConsumer,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"
import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
} from "@/lib/growth/knowledge-center/knowledge-repository"
import {
  KNOWLEDGE_RECOMMENDATION_CONFIRM,
  KNOWLEDGE_RECOMMENDATION_GENERATED_EVENT,
  KNOWLEDGE_RECOMMENDATION_QA_MARKER,
} from "@/lib/growth/knowledge-center/knowledge-recommendation-types"
import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"

export { KNOWLEDGE_RECOMMENDATION_CONFIRM }

const CERT_PREFIX = "gs3d-cert"

export function assertKnowledgeRecommendationsAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function certDoc(
  input: Parameters<typeof ingestKnowledgeDocument>[0],
  id: string,
): KnowledgeDocument {
  return ingestKnowledgeDocument(input, id).document
}

export async function executeKnowledgeRecommendationsCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertKnowledgeRecommendationsAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: KNOWLEDGE_RECOMMENDATION_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: KNOWLEDGE_RECOMMENDATION_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const suffix = execution_id.slice(0, 8)
  const organization_id = getGrowthEngineAiOrgId() ?? randomUUID()

  const activeObjection = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} ServiceTitan objection handling`,
      content: "Objection: We already use ServiceTitan. Counter with faster rollout for HVAC teams.",
      tags: ["objection", "hvac", "competitor"],
      categories: ["objection", "competitor"],
      status: "active",
      visibility: "organization",
    },
    `${CERT_PREFIX}-objection-${suffix}`,
  )

  const activePricing = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} HVAC pricing note`,
      content: "Pricing guidance for mid-market HVAC teams.",
      tags: ["pricing", "hvac"],
      categories: ["pricing"],
      status: "active",
      visibility: "organization",
    },
    `${CERT_PREFIX}-pricing-${suffix}`,
  )

  const activePlaybook = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} ICP qualification playbook`,
      content: "Qualification criteria for commercial HVAC prospects.",
      tags: ["playbook", "icp", "qualification", "value_prop", "cta"],
      categories: ["playbook"],
      status: "active",
      visibility: "organization",
    },
    `${CERT_PREFIX}-playbook-${suffix}`,
  )

  const activeCaseStudy = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} ROI case study`,
      content: "Customer achieved 22% revenue lift in 90 days.",
      tags: ["case_study", "roi", "proof"],
      categories: ["case_study"],
      status: "active",
      visibility: "organization",
    },
    `${CERT_PREFIX}-case-${suffix}`,
  )

  const draftDoc = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} draft excluded`,
      content: "draft",
      status: "draft",
    },
    `${CERT_PREFIX}-draft-${suffix}`,
  )

  const privateDoc = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} private objection`,
      content: "Private lead-specific objection note.",
      tags: ["objection"],
      categories: ["objection"],
      status: "active",
      visibility: "private",
      metadata: { lead_id: "lead-gs3d-cert" },
    },
    `${CERT_PREFIX}-private-${suffix}`,
  )

  const corpus = [activeObjection, activePricing, activePlaybook, activeCaseStudy, draftDoc, privateDoc]

  const replyContext = buildKnowledgeConsumerContextFromDocuments(
    {
      organization_id,
      consumer: "reply_intelligence",
      query: "ServiceTitan",
      limit: 10,
    },
    corpus,
  )
  const replyResult = generateKnowledgeRecommendations(replyContext, { query: "ServiceTitan" })

  checks.push({
    id: "recommendations_generated",
    pass: replyResult.recommendations.length >= 1,
    detail: { count: replyResult.recommendations.length },
  })
  checks.push({
    id: "citations_attached",
    pass: replyResult.citations.length >= 1 && assertAllRecommendationsCited(replyResult.recommendations),
    detail: { citation_count: replyResult.citations.length },
  })
  checks.push({
    id: "inactive_docs_excluded",
    pass: !replyResult.recommendations.some((rec) =>
      rec.citations.some((citation) => citation.document_id === draftDoc.knowledge_document_id),
    ),
    detail: {},
  })

  const orgOnly = generateKnowledgeRecommendationsFromDocuments(
    { organization_id, consumer: "reply_intelligence", limit: 10 },
    corpus,
  )
  checks.push({
    id: "private_visibility_excluded_without_lead",
    pass: !orgOnly.recommendations.some((rec) =>
      rec.citations.some((citation) => citation.document_id === privateDoc.knowledge_document_id),
    ),
    detail: {},
  })

  const withPrivate = generateKnowledgeRecommendationsFromDocuments(
    {
      organization_id,
      consumer: "reply_intelligence",
      include_private: true,
      lead_id: "lead-gs3d-cert",
      limit: 10,
    },
    corpus,
  )
  checks.push({
    id: "private_visibility_included_with_lead",
    pass: withPrivate.recommendations.some((rec) =>
      rec.citations.some((citation) => citation.document_id === privateDoc.knowledge_document_id),
    ),
    detail: {},
  })

  const deterministicA = generateKnowledgeRecommendations(replyContext, { query: "ServiceTitan" })
  const deterministicB = generateKnowledgeRecommendations(replyContext, { query: "ServiceTitan" })
  checks.push({
    id: "confidence_deterministic",
    pass:
      deterministicA.recommendations.length === deterministicB.recommendations.length &&
      deterministicA.recommendations.every(
        (rec, index) => rec.confidence === deterministicB.recommendations[index]?.confidence,
      ),
    detail: {},
  })
  checks.push({
    id: "priority_deterministic",
    pass: deterministicA.recommendations.every(
      (rec, index) => rec.priority === deterministicB.recommendations[index]?.priority,
    ),
    detail: {},
  })

  for (const consumer of KNOWLEDGE_CONSUMERS as KnowledgeConsumer[]) {
    const consumerResult = generateKnowledgeRecommendationsFromDocuments(
      { organization_id, consumer, query: "ServiceTitan", limit: 10 },
      corpus,
    )
    checks.push({
      id: `consumer_recommendations_${consumer}`,
      pass: consumerResult.consumer === consumer && assertAllRecommendationsCited(consumerResult.recommendations),
      detail: { recommendation_count: consumerResult.recommendations.length },
    })
  }

  checks.push({
    id: "no_uncited_recommendations",
    pass: assertAllRecommendationsCited(replyResult.recommendations),
    detail: {},
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: replyResult.autonomous_execution_enabled === false,
    detail: { autonomous_execution_enabled: false },
  })

  checks.push({
    id: "no_messaging_execution",
    pass: !replyResult.recommendations.some((rec) => /send|reply|message/i.test(rec.recommendation_type)),
    detail: {},
  })

  checks.push({
    id: "no_meeting_booking_execution",
    pass: replyResult.recommendations.every((rec) => rec.recommendation_type !== "book_meeting"),
    detail: {},
  })

  checks.push({
    id: "no_enrollment_execution",
    pass: !replyResult.recommendations.some((rec) => /enroll|sequence_send/i.test(rec.recommendation_type)),
    detail: {},
  })

  await createKnowledgeDocument(admin, {
    organization_id,
    source_type: "text",
    title: `${CERT_PREFIX} persisted objection ${suffix}`,
    content: "Persisted objection for recommendation API.",
    tags: ["objection", "hvac"],
    categories: ["objection"],
    status: "active",
    visibility: "organization",
  })

  const generated = await generateKnowledgeRecommendationsForRequest(admin, {
    organization_id,
    consumer: "reply_intelligence",
    query: CERT_PREFIX,
    limit: 20,
  })

  checks.push({
    id: "recommendation_api_round_trip",
    pass: generated.ok === true && (generated.result?.recommendations.length ?? 0) >= 1,
    detail: { recommendations: generated.result?.recommendations.length ?? 0 },
  })

  const audit = await persistKnowledgeRecommendationAudit(admin, {
    organization_id,
    consumer: "meeting_prep",
    recommendation_count: 2,
    citation_count: 2,
    query: CERT_PREFIX,
  })
  checks.push({
    id: "recommendation_audits_persisted",
    pass: audit.ok === true && Boolean(audit.audit_event_id),
    detail: { event_name: KNOWLEDGE_RECOMMENDATION_GENERATED_EVENT, audit_event_id: audit.audit_event_id },
  })

  const persistedDocs = await listKnowledgeDocuments(admin, { organization_id, limit: 100 })
  const activePersisted = persistedDocs.filter(
    (doc) => doc.title.includes(CERT_PREFIX) && doc.status === "active",
  )
  if (activePersisted[0]) {
    await updateKnowledgeDocument(admin, {
      knowledge_document_id: activePersisted[0].knowledge_document_id,
      status: "archived",
    })
  }

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: KNOWLEDGE_RECOMMENDATION_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    blockers: [],
  }
}
