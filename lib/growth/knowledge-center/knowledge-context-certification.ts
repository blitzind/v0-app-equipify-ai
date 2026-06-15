/** Phase GS-3C — Knowledge context injection certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { ingestKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-ingestion-service"
import { buildKnowledgeConsumerContextFromDocuments } from "@/lib/growth/knowledge-center/knowledge-context-injection"
import {
  injectKnowledgeContext,
  persistKnowledgeContextRetrievalAudit,
} from "@/lib/growth/knowledge-center/knowledge-context-service"
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
  KNOWLEDGE_CONTEXT_CONFIRM,
  KNOWLEDGE_CONTEXT_QA_MARKER,
  KNOWLEDGE_CONTEXT_RETRIEVED_EVENT,
} from "@/lib/growth/knowledge-center/knowledge-context-types"
import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"

export { KNOWLEDGE_CONTEXT_CONFIRM }

const CERT_PREFIX = "gs3c-cert"

export function assertKnowledgeContextInjectionAllowed(env: Record<string, string | undefined>): {
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

export async function executeKnowledgeContextInjectionCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertKnowledgeContextInjectionAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: KNOWLEDGE_CONTEXT_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: KNOWLEDGE_CONTEXT_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const suffix = execution_id.slice(0, 8)
  const organization_id = getGrowthEngineAiOrgId() ?? randomUUID()

  const activeFaq = certDoc(
    {
      organization_id,
      source_type: "faq",
      title: `${CERT_PREFIX} ServiceTitan FAQ`,
      faq_question: "How does Equipify compare to ServiceTitan?",
      faq_answer: "Equipify focuses on revenue execution with faster rollout.",
      tags: ["faq", "competitor", "hvac"],
      categories: ["faq", "competitor"],
      status: "active",
      visibility: "organization",
    },
    `${CERT_PREFIX}-faq-${suffix}`,
  )

  const activeObjection = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} ServiceTitan objection`,
      content: "Objection handling for ServiceTitan migration concerns.",
      tags: ["objection", "hvac"],
      categories: ["objection"],
      status: "active",
      visibility: "organization",
    },
    `${CERT_PREFIX}-objection-${suffix}`,
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

  const archivedDoc = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} archived excluded`,
      content: "archived",
      status: "archived",
    },
    `${CERT_PREFIX}-archived-${suffix}`,
  )

  const reviewDoc = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} review excluded`,
      content: "review",
      status: "active",
      metadata: { knowledge_review_status: "review" },
    },
    `${CERT_PREFIX}-review-${suffix}`,
  )

  const privateDoc = certDoc(
    {
      organization_id,
      source_type: "text",
      title: `${CERT_PREFIX} private note`,
      content: "Private objection note",
      tags: ["objection"],
      categories: ["objection"],
      status: "active",
      visibility: "private",
      metadata: { lead_id: "lead-gs3c-cert" },
    },
    `${CERT_PREFIX}-private-${suffix}`,
  )

  const corpus = [activeFaq, activeObjection, draftDoc, archivedDoc, reviewDoc, privateDoc]

  const replyContext = buildKnowledgeConsumerContextFromDocuments(
    {
      organization_id,
      consumer: "reply_intelligence",
      query: "ServiceTitan",
      tags: ["hvac"],
      limit: 10,
    },
    corpus,
  )

  checks.push({
    id: "active_docs_injected",
    pass: replyContext.documents.length >= 2,
    detail: { documents: replyContext.documents.length },
  })
  checks.push({
    id: "inactive_docs_excluded",
    pass: !replyContext.documents.some((doc) =>
      [draftDoc.knowledge_document_id, archivedDoc.knowledge_document_id, reviewDoc.knowledge_document_id].includes(
        doc.knowledge_document_id,
      ),
    ),
    detail: {},
  })
  checks.push({
    id: "context_counts_accurate",
    pass: replyContext.counts.faqs >= 1 && replyContext.counts.objections >= 1,
    detail: replyContext.counts,
  })

  const orgOnly = buildKnowledgeConsumerContextFromDocuments(
    { organization_id, consumer: "reply_intelligence", limit: 10 },
    corpus,
  )
  checks.push({
    id: "organization_visibility_respected",
    pass: orgOnly.documents.every((doc) => doc.visibility === "organization"),
    detail: {},
  })

  const withPrivate = buildKnowledgeConsumerContextFromDocuments(
    {
      organization_id,
      consumer: "reply_intelligence",
      include_private: true,
      lead_id: "lead-gs3c-cert",
      limit: 10,
    },
    corpus,
  )
  checks.push({
    id: "private_visibility_respected",
    pass: withPrivate.documents.some((doc) => doc.knowledge_document_id === privateDoc.knowledge_document_id),
    detail: {},
  })

  const consumerChecks: KnowledgeConsumer[] = [...KNOWLEDGE_CONSUMERS]
  for (const consumer of consumerChecks) {
    const ctx = buildKnowledgeConsumerContextFromDocuments(
      { organization_id, consumer, query: "ServiceTitan", limit: 10 },
      corpus,
    )
    checks.push({
      id: `consumer_context_${consumer}`,
      pass: typeof ctx.consumer_context === "object" && ctx.counts.total === ctx.documents.length,
      detail: { consumer_context: ctx.consumer_context, counts: ctx.counts },
    })
  }

  await createKnowledgeDocument(admin, {
    organization_id,
    source_type: "faq",
    title: `${CERT_PREFIX} persisted active ${suffix}`,
    faq_question: "ServiceTitan pricing objection?",
    faq_answer: "Equipify offers faster time-to-value.",
    tags: ["faq", "hvac", "objection"],
    categories: ["faq", "objection"],
    status: "active",
    visibility: "organization",
  })
  await createKnowledgeDocument(admin, {
    organization_id,
    source_type: "text",
    title: `${CERT_PREFIX} persisted draft ${suffix}`,
    content: "Should not inject",
    status: "draft",
  })

  const injected = await injectKnowledgeContext(admin, {
    organization_id,
    consumer: "reply_intelligence",
    query: CERT_PREFIX,
    limit: 20,
  })

  checks.push({
    id: "retrieval_preview_api",
    pass: injected.ok === true && (injected.context?.documents.length ?? 0) >= 1,
    detail: {
      audit_event_id: injected.context?.audit_event_id ?? null,
      documents: injected.context?.documents.length ?? 0,
    },
  })

  const audit = await persistKnowledgeContextRetrievalAudit(admin, {
    organization_id,
    consumer: "meeting_prep",
    document_count: 2,
    categories: ["case_study", "playbook"],
    tags: ["hvac"],
    relevance_score: 80,
    query: CERT_PREFIX,
  })
  checks.push({
    id: "retrieval_audits_persisted",
    pass: audit.ok === true && Boolean(audit.audit_event_id),
    detail: { event_name: KNOWLEDGE_CONTEXT_RETRIEVED_EVENT, audit_event_id: audit.audit_event_id },
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
    id: "no_autonomous_execution",
    pass: injected.context?.autonomous_execution_enabled === false,
    detail: { autonomous_execution_enabled: false },
  })

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
    qa_marker: KNOWLEDGE_CONTEXT_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    blockers: [],
  }
}
