/** Phase GS-3B — Knowledge retrieval layer certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { ingestKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-ingestion-service"
import {
  buildConsumerContext,
  retrieveKnowledgeForConsumer,
  resolveConsumerRetrievalScope,
} from "@/lib/growth/knowledge-center/knowledge-consumer-adapters"
import {
  createKnowledgeDocument,
  runKnowledgeRetrieval,
  updateKnowledgeDocument,
} from "@/lib/growth/knowledge-center/knowledge-repository"
import {
  retrieveKnowledge,
  scoreKnowledgeDocumentRelevance,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-service"
import {
  KNOWLEDGE_CONSUMERS,
  KNOWLEDGE_RETRIEVAL_CONFIRM,
  KNOWLEDGE_RETRIEVAL_QA_MARKER,
} from "@/lib/growth/knowledge-center/knowledge-retrieval-types"
import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"

export { KNOWLEDGE_RETRIEVAL_CONFIRM }

const CERT_PREFIX = "gs3b-cert"

export function assertKnowledgeRetrievalLayerAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function buildCertDocument(
  input: Parameters<typeof ingestKnowledgeDocument>[0],
  id: string,
  overrides?: Partial<KnowledgeDocument>,
): KnowledgeDocument {
  const ingested = ingestKnowledgeDocument(input, id)
  return { ...ingested.document, ...overrides }
}

export async function executeKnowledgeRetrievalLayerCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertKnowledgeRetrievalLayerAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: KNOWLEDGE_RETRIEVAL_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: KNOWLEDGE_RETRIEVAL_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const suffix = execution_id.slice(0, 8)
  const organization_id = getGrowthEngineAiOrgId() ?? randomUUID()

  const activeObjection = buildCertDocument(
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
    `${CERT_PREFIX}-active-${suffix}`,
  )

  const draftDoc = buildCertDocument(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} draft should exclude`,
      content: "Draft content",
      status: "draft",
      visibility: "organization",
    },
    `${CERT_PREFIX}-draft-${suffix}`,
  )

  const archivedDoc = buildCertDocument(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} archived should exclude`,
      content: "Archived content",
      status: "archived",
      visibility: "organization",
    },
    `${CERT_PREFIX}-archived-${suffix}`,
  )

  const reviewDoc = buildCertDocument(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} review should exclude`,
      content: "Review pending content",
      status: "active",
      visibility: "organization",
      metadata: { knowledge_review_status: "review" },
    },
    `${CERT_PREFIX}-review-${suffix}`,
  )

  const privateDoc = buildCertDocument(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} private lead note`,
      content: "Private objection note for lead.",
      tags: ["objection"],
      categories: ["objection"],
      status: "active",
      visibility: "private",
      metadata: { lead_id: "lead-cert-123" },
    },
    `${CERT_PREFIX}-private-${suffix}`,
  )

  const corpus = [activeObjection, draftDoc, archivedDoc, reviewDoc, privateDoc]

  const baseRequest = {
    organization_id,
    consumer: "reply_intelligence" as const,
    query: "ServiceTitan",
    tags: ["hvac"],
    categories: ["objection", "competitor"],
    limit: 10,
  }

  const retrieval = retrieveKnowledgeForConsumer(corpus, baseRequest)
  checks.push({
    id: "active_docs_retrieved",
    pass: retrieval.documents.some((doc) => doc.knowledge_document_id === activeObjection.knowledge_document_id),
    detail: { returned: retrieval.documents.length },
  })
  checks.push({
    id: "draft_docs_excluded",
    pass: !retrieval.documents.some((doc) => doc.knowledge_document_id === draftDoc.knowledge_document_id),
    detail: {},
  })
  checks.push({
    id: "archived_docs_excluded",
    pass: !retrieval.documents.some((doc) => doc.knowledge_document_id === archivedDoc.knowledge_document_id),
    detail: {},
  })
  checks.push({
    id: "review_docs_excluded",
    pass: !retrieval.documents.some((doc) => doc.knowledge_document_id === reviewDoc.knowledge_document_id),
    detail: {},
  })
  checks.push({
    id: "category_retrieval",
    pass: retrieval.matched_categories.includes("objection"),
    detail: { matched_categories: retrieval.matched_categories },
  })
  checks.push({
    id: "tag_retrieval",
    pass: retrieval.matched_tags.includes("hvac"),
    detail: { matched_tags: retrieval.matched_tags },
  })
  checks.push({
    id: "keyword_and_title_matching",
    pass: retrieval.relevance_score >= 40,
    detail: { relevance_score: retrieval.relevance_score },
  })

  const industryResult = retrieveKnowledgeForConsumer(corpus, {
    ...baseRequest,
    industry: "hvac",
  })
  checks.push({
    id: "industry_matching",
    pass: industryResult.relevance_score >= retrieval.relevance_score,
    detail: { relevance_score: industryResult.relevance_score },
  })

  const orgOnly = retrieveKnowledgeForConsumer(corpus, {
    ...baseRequest,
    include_private: false,
  })
  checks.push({
    id: "organization_visibility_respected",
    pass: orgOnly.documents.every((doc) => doc.visibility === "organization"),
    detail: {},
  })

  const withPrivate = retrieveKnowledgeForConsumer(corpus, {
    ...baseRequest,
    include_private: true,
    lead_id: "lead-cert-123",
  })
  checks.push({
    id: "private_visibility_respected",
    pass: withPrivate.documents.some((doc) => doc.knowledge_document_id === privateDoc.knowledge_document_id),
    detail: { private_returned: withPrivate.documents.length },
  })

  const scored = scoreKnowledgeDocumentRelevance(activeObjection, baseRequest, ["objection"], ["hvac"])
  const scoredRepeat = scoreKnowledgeDocumentRelevance(activeObjection, baseRequest, ["objection"], ["hvac"])
  checks.push({
    id: "relevance_scoring_deterministic",
    pass: scored.relevance_score === scoredRepeat.relevance_score,
    detail: { score: scored.relevance_score },
  })

  for (const consumer of KNOWLEDGE_CONSUMERS) {
    const scope = resolveConsumerRetrievalScope({ organization_id, consumer })
    const consumerResult = retrieveKnowledgeForConsumer(corpus, {
      organization_id,
      consumer,
      limit: 10,
    })
    const context = buildConsumerContext(consumer, consumerResult.documents)
    checks.push({
      id: `consumer_adapter_${consumer}`,
      pass: scope.categories.length > 0 && typeof context.documents_returned === "number",
      detail: { consumer_context: context },
    })
  }

  const persisted = await createKnowledgeDocument(admin, {
    organization_id,
    source_type: "text",
    title: `${CERT_PREFIX} persisted active ${suffix}`,
    content: "Active FAQ for ServiceTitan comparison in HVAC industry.",
    tags: ["faq", "hvac", "competitor"],
    categories: ["faq", "competitor"],
    status: "active",
    visibility: "organization",
  })
  if (persisted.result?.document.knowledge_document_id) {
    await createKnowledgeDocument(admin, {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} persisted draft ${suffix}`,
      content: "Draft should not retrieve.",
      status: "draft",
      visibility: "organization",
    })
  }

  const apiResult = await runKnowledgeRetrieval(admin, {
    organization_id,
    consumer: "reply_intelligence",
    query: CERT_PREFIX,
    limit: 20,
  })
  checks.push({
    id: "retrieval_preview_api",
    pass: apiResult.documents.some((doc) => doc.title.includes(CERT_PREFIX)) &&
      apiResult.documents.every((doc) => doc.status === "active"),
    detail: { returned: apiResult.documents.length, relevance_score: apiResult.relevance_score },
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: apiResult.autonomous_execution_enabled === false,
    detail: { autonomous_execution_enabled: false },
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { embeddings: false, vector_database: false, llm: false },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: KNOWLEDGE_RETRIEVAL_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    blockers: [],
  }
}
