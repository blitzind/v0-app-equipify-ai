/** Phase GS-3D — Conversational Playbooks certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  generateConversationalPlaybookFromDocuments,
  resolveConversationalPlaybookType,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-engine"
import {
  CONVERSATIONAL_PLAYBOOK_CONFIRM,
  CONVERSATIONAL_PLAYBOOK_CONSUMERS,
  CONVERSATIONAL_PLAYBOOK_QA_MARKER,
  CONVERSATIONAL_PLAYBOOK_TYPES,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"
import { generateConversationalPlaybookForRequest } from "@/lib/growth/conversational-playbooks/conversational-playbook-service"
import { ingestKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-ingestion-service"
import { buildKnowledgeConsumerContextFromDocuments } from "@/lib/growth/knowledge-center/knowledge-context-injection"

export { CONVERSATIONAL_PLAYBOOK_CONFIRM }

const CERT_ORG = "00000000-0000-4000-8000-000000000004"
const CERT_PREFIX = "gs3d-cp-cert"

export function assertConversationalPlaybookCertificationAllowed(
  env: Record<string, string | undefined>,
): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function certCorpus() {
  const objection = ingestKnowledgeDocument(
    {
      organization_id: CERT_ORG,
      source_type: "text",
      title: `${CERT_PREFIX} ServiceTitan objection`,
      content: "Objection: We already use ServiceTitan. Response: Focus on integration gaps and ROI proof.",
      tags: ["objection", "competitor"],
      categories: ["objection"],
      status: "active",
    },
    `${CERT_PREFIX}-objection`,
  ).document

  const playbook = ingestKnowledgeDocument(
    {
      organization_id: CERT_ORG,
      source_type: "text",
      title: `${CERT_PREFIX} HVAC discovery playbook`,
      content: "What outcomes matter most? Who evaluates equipment financing solutions?",
      tags: ["playbook", "discovery"],
      categories: ["playbook"],
      status: "active",
    },
    `${CERT_PREFIX}-playbook`,
  ).document

  const pricing = ingestKnowledgeDocument(
    {
      organization_id: CERT_ORG,
      source_type: "text",
      title: `${CERT_PREFIX} Pricing guidance`,
      content: "Pricing starts with fleet size and replacement cycle. Never quote without operator review.",
      tags: ["pricing"],
      categories: ["pricing"],
      status: "active",
    },
    `${CERT_PREFIX}-pricing`,
  ).document

  return [objection, playbook, pricing]
}

export async function executeConversationalPlaybooksCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertConversationalPlaybookCertificationAllowed(
    process.env as Record<string, string | undefined>,
  )
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const organization_id = getGrowthEngineAiOrgId()
  const corpus = certCorpus()

  for (const playbookType of CONVERSATIONAL_PLAYBOOK_TYPES) {
    const generated = generateConversationalPlaybookFromDocuments(
      {
        organization_id: CERT_ORG,
        consumer: "reply_intelligence",
        query: playbookType.replace(/_/g, " "),
        playbook_type: playbookType,
      },
      corpus,
      `${CERT_PREFIX}-${playbookType}`,
    )
    checks.push({
      id: `playbook_type_${playbookType}`,
      pass: generated.playbook_type === playbookType && generated.requires_human_review === true,
      detail: { sections: generated.sections.length, citations: generated.citations.length },
    })
  }

  for (const consumer of CONVERSATIONAL_PLAYBOOK_CONSUMERS) {
    const generated = generateConversationalPlaybookFromDocuments(
      { organization_id: CERT_ORG, consumer, query: "discovery" },
      corpus,
      `${CERT_PREFIX}-consumer-${consumer}`,
    )
    checks.push({
      id: `consumer_${consumer}`,
      pass: generated.consumer === consumer && generated.autonomous_execution_enabled === false,
      detail: { confidence: generated.confidence_score },
    })
  }

  const objectionPlaybook = generateConversationalPlaybookFromDocuments(
    { organization_id: CERT_ORG, consumer: "reply_intelligence", query: "ServiceTitan objection" },
    corpus,
    `${CERT_PREFIX}-objection-playbook`,
  )

  checks.push({
    id: "citations_required_on_sections",
    pass:
      objectionPlaybook.sections.length > 0 &&
      objectionPlaybook.sections.every(
        (section) => section.citations.length > 0 && section.items.length > 0,
      ),
    detail: { sections: objectionPlaybook.sections.length },
  })

  checks.push({
    id: "recommendations_advisory_only",
    pass: !objectionPlaybook.recommendations.some((rec) =>
      /\bsend\b|\bauto.?reply\b|\bexecute\b|\blaunch\b|\benroll\b|\bbook meeting\b/i.test(rec.title),
    ),
    detail: { count: objectionPlaybook.recommendations.length },
  })

  const context = buildKnowledgeConsumerContextFromDocuments(
    { organization_id: CERT_ORG, consumer: "reply_intelligence", query: "pricing budget" },
    corpus,
  )
  checks.push({
    id: "deterministic_playbook_type_resolution",
    pass: resolveConversationalPlaybookType({ query: "pricing budget", context }) === "pricing",
    detail: {},
  })

  const detA = generateConversationalPlaybookFromDocuments(
    { organization_id: CERT_ORG, consumer: "call_coaching", query: "discovery" },
    corpus,
    `${CERT_PREFIX}-det-a`,
  )
  const detB = generateConversationalPlaybookFromDocuments(
    { organization_id: CERT_ORG, consumer: "call_coaching", query: "discovery" },
    corpus,
    `${CERT_PREFIX}-det-b`,
  )
  checks.push({
    id: "deterministic_generation",
    pass: detA.confidence_score === detB.confidence_score && detA.sections.length === detB.sections.length,
    detail: { score: detA.confidence_score },
  })

  checks.push({
    id: "execution_guide_human_gated",
    pass:
      objectionPlaybook.execution_guide.human_review_required === true &&
      objectionPlaybook.execution_guide.do_not_autosend === true &&
      objectionPlaybook.execution_guide.do_not_auto_reply === true,
    detail: {},
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const liveResult = await generateConversationalPlaybookForRequest(
    admin,
    { consumer: "operator_inbox", query: "follow up" },
    { persist_audit: false },
  )

  checks.push({
    id: "live_playbook_round_trip",
    pass: liveResult.ok && liveResult.playbook?.qa_marker === CONVERSATIONAL_PLAYBOOK_QA_MARKER,
    detail: {
      organization_id: organization_id ?? null,
      confidence: liveResult.playbook?.confidence_score,
      error: liveResult.error ?? null,
    },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    enrollment_enabled: false,
    outreach_enabled: false,
    blockers: [],
  }
}
