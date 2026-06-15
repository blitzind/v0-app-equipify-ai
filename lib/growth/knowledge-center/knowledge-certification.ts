/** Phase GS-3A — Knowledge Center foundation certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-classification"
import { ingestKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-ingestion-service"
import {
  archiveKnowledgeDocument,
  createKnowledgeDocument,
  runKnowledgeSearch,
  updateKnowledgeDocument,
} from "@/lib/growth/knowledge-center/knowledge-repository"
import { searchKnowledge } from "@/lib/growth/knowledge-center/knowledge-search"
import {
  KNOWLEDGE_CENTER_CONFIRM,
  KNOWLEDGE_CENTER_QA_MARKER,
} from "@/lib/growth/knowledge-center/knowledge-document-types"

export { KNOWLEDGE_CENTER_CONFIRM }

const CERT_PREFIX = "gs3a-cert"

export function assertKnowledgeCenterFoundationAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export async function executeKnowledgeCenterFoundationCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertKnowledgeCenterFoundationAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const suffix = execution_id.slice(0, 8)

  const urlIngestion = ingestKnowledgeDocument(
    {
      source_type: "url",
      title: `${CERT_PREFIX} Equipify Pricing Page`,
      source_url: "https://equipify.ai/pricing",
      content: "Pricing tiers for field service teams. Starter, Growth, Enterprise plans.",
      tags: ["pricing"],
      status: "draft",
    },
    `${CERT_PREFIX}-url-${suffix}`,
  )
  checks.push({
    id: "url_ingestion",
    pass: urlIngestion.classification.category === "pricing" && urlIngestion.warnings.length >= 0,
    detail: { category: urlIngestion.classification.category, warnings: urlIngestion.warnings },
  })

  const fileIngestion = ingestKnowledgeDocument(
    {
      source_type: "file",
      title: `${CERT_PREFIX} HVAC Sales Playbook`,
      source_filename: "hvac-sales-playbook.pdf",
      content: "Sales playbook messaging for HVAC owners and service managers.",
      status: "draft",
    },
    `${CERT_PREFIX}-file-${suffix}`,
  )
  checks.push({
    id: "file_ingestion",
    pass: fileIngestion.classification.category === "playbook",
    detail: { category: fileIngestion.classification.category },
  })

  const faqIngestion = ingestKnowledgeDocument(
    {
      source_type: "faq",
      title: `${CERT_PREFIX} ServiceTitan comparison`,
      faq_question: "How does Equipify compare to ServiceTitan?",
      faq_answer: "Equipify focuses on revenue execution with lighter operational overhead.",
      status: "draft",
    },
    `${CERT_PREFIX}-faq-${suffix}`,
  )
  checks.push({
    id: "faq_ingestion",
    pass: faqIngestion.classification.category === "faq" && faqIngestion.document.content.includes("Q:"),
    detail: { category: faqIngestion.classification.category },
  })

  const noteIngestion = ingestKnowledgeDocument(
    {
      source_type: "text",
      title: `${CERT_PREFIX} Objection handling note`,
      content: "Objection: We already use ServiceTitan. Counter with faster rollout and coaching.",
      tags: ["objection"],
      status: "draft",
    },
    `${CERT_PREFIX}-note-${suffix}`,
  )
  checks.push({
    id: "note_ingestion",
    pass: noteIngestion.classification.category === "objection" || noteIngestion.classification.category === "competitor",
    detail: { category: noteIngestion.classification.category },
  })

  const competitorClass = classifyKnowledgeDocument({
    title: "ServiceTitan battle card",
    content: "Competitor comparison vs ServiceTitan for HVAC contractors.",
    source_type: "text",
  })
  checks.push({
    id: "classification",
    pass: competitorClass.category === "competitor",
    detail: competitorClass,
  })

  const localSearch = searchKnowledge(
    [urlIngestion.document, fileIngestion.document, faqIngestion.document, noteIngestion.document],
    { query: "ServiceTitan", limit: 10 },
  )
  checks.push({
    id: "search",
    pass: localSearch.total >= 1,
    detail: { total: localSearch.total },
  })

  const tagSearch = searchKnowledge([urlIngestion.document, fileIngestion.document], {
    tags: ["pricing"],
    limit: 10,
  })
  checks.push({
    id: "tag_search",
    pass: tagSearch.total >= 1,
    detail: { total: tagSearch.total },
  })

  const categorySearch = searchKnowledge([fileIngestion.document], {
    category: "playbook",
    limit: 10,
  })
  checks.push({
    id: "category_search",
    pass: categorySearch.total >= 1,
    detail: { total: categorySearch.total },
  })

  const persistedUrl = await createKnowledgeDocument(admin, {
    source_type: "url",
    title: `${CERT_PREFIX} persisted url ${suffix}`,
    source_url: "https://equipify.ai/product",
    content: "Product documentation overview for platform capabilities.",
    status: "draft",
  })
  checks.push({
    id: "repository_persist",
    pass: persistedUrl.ok === true,
    detail: { document_id: persistedUrl.result?.document.knowledge_document_id ?? null },
  })

  const docId = persistedUrl.result?.document.knowledge_document_id
  if (docId) {
    const activated = await updateKnowledgeDocument(admin, {
      knowledge_document_id: docId,
      status: "active",
      tags: ["product", "documentation"],
    })
    const archived = await archiveKnowledgeDocument(admin, docId)
    checks.push({
      id: "archive_workflow",
      pass: activated.ok === true && archived.ok === true && archived.document?.status === "archived",
      detail: { status: archived.document?.status ?? null },
    })
  } else {
    checks.push({ id: "archive_workflow", pass: false, detail: { error: "missing_document_id" } })
  }

  const remoteSearch = await runKnowledgeSearch(admin, {
    query: CERT_PREFIX,
    limit: 20,
  })
  checks.push({
    id: "repository_search",
    pass: remoteSearch.total >= 1,
    detail: { total: remoteSearch.total },
  })

  checks.push({
    id: "no_autonomous_execution",
    pass:
      urlIngestion.autonomous_execution_enabled === false &&
      persistedUrl.result?.autonomous_execution_enabled === false,
    detail: { autonomous_execution_enabled: false },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    blockers: [],
  }
}
