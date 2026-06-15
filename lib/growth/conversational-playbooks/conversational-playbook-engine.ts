/** Phase GS-3D — Deterministic Conversational Playbook engine (client-safe). */

import { buildKnowledgeCitations } from "@/lib/growth/knowledge-center/knowledge-citation-builder"
import { buildKnowledgeConsumerContextFromDocuments } from "@/lib/growth/knowledge-center/knowledge-context-injection"
import type { KnowledgeConsumerContext } from "@/lib/growth/knowledge-center/knowledge-context-types"
import type { KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import type { KnowledgeConsumer } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"
import {
  CONVERSATIONAL_PLAYBOOK_QA_MARKER,
  CONVERSATIONAL_PLAYBOOK_SECTION_LABELS,
  CONVERSATIONAL_PLAYBOOK_TYPE_LABELS,
  type ConversationalPlaybook,
  type ConversationalPlaybookCitation,
  type ConversationalPlaybookConsumer,
  type ConversationalPlaybookGenerateRequest,
  type ConversationalPlaybookRecommendation,
  type ConversationalPlaybookSection,
  type ConversationalPlaybookSectionType,
  type ConversationalPlaybookType,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"

export const CONVERSATIONAL_TO_KNOWLEDGE_CONSUMER: Record<ConversationalPlaybookConsumer, KnowledgeConsumer> = {
  reply_intelligence: "reply_intelligence",
  sms: "reply_intelligence",
  email: "reply_intelligence",
  voice_drop: "voice_drop",
  call_coaching: "call_coaching",
  meeting_prep: "meeting_prep",
  opportunity_intelligence: "opportunity_intelligence",
  operator_inbox: "reply_intelligence",
}

const DEFAULT_DISCOVERY_QUESTIONS = [
  "What outcomes would make this initiative successful for your team?",
  "Who else is involved in evaluating solutions like this?",
  "What is your timeline for making a decision?",
  "What has worked or not worked with your current approach?",
] as const

const DEFAULT_QUALIFICATION_PROMPTS = [
  "Confirm budget authority and decision process before advancing.",
  "Validate ICP fit: team size, industry, and tech stack alignment.",
  "Identify urgency drivers and consequences of inaction.",
] as const

const DEFAULT_RISKS = [
  "Do not send messages or schedule meetings without human approval.",
  "Verify citation documents match the prospect's industry and situation.",
  "Escalate pricing or legal questions to an operator before responding.",
] as const

function extractBulletItems(document: KnowledgeDocument, max = 3): string[] {
  const source = document.summary?.trim() || document.content?.trim() || document.title
  const lines = source
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length >= 12)
  if (lines.length > 0) return lines.slice(0, max)
  return [`Review "${document.title}" for operator guidance.`]
}

function toPlaybookCitations(documents: KnowledgeDocument[]): ConversationalPlaybookCitation[] {
  return buildKnowledgeCitations(documents)
}

function computeConfidence(context: KnowledgeConsumerContext, documentCount: number): number {
  if (documentCount === 0) return 0
  const docBoost = Math.min(20, documentCount * 4)
  return Math.min(100, Math.round(context.relevance_score * 0.65 + docBoost))
}

export function resolveConversationalPlaybookType(input: {
  query?: string | null
  context: KnowledgeConsumerContext
  explicit?: ConversationalPlaybookType | null
}): ConversationalPlaybookType {
  if (input.explicit) return input.explicit

  const q = (input.query ?? "").toLowerCase()
  const ctx = input.context

  if (/price|pricing|cost|budget|quote/i.test(q)) {
    return "pricing"
  }
  if (/competitor|service\s*titan|compared to|versus/i.test(q)) {
    return "competitive"
  }
  if (/objection|concern|pushback|not interested|too expensive/i.test(q)) {
    return "objection_handling"
  }
  if (/meeting|demo|call|schedule|calendar/i.test(q)) {
    return "meeting"
  }
  if (/qualif|fit|icp|authority|budget holder/i.test(q)) {
    return "qualification"
  }
  if (/follow.?up|nurture|check.?in|re-?engage/i.test(q)) {
    return "follow_up"
  }
  if (/next step|action item|what should i|how do i respond/i.test(q)) {
    return "next_step"
  }

  if (ctx.objections.length > 0) {
    return "objection_handling"
  }
  if (ctx.pricing_notes.length > 0) {
    return "pricing"
  }
  if (ctx.competitors.length > 0) {
    return "competitive"
  }
  if (ctx.playbooks.length > 0 || ctx.faqs.length > 0) {
    return "discovery"
  }
  return "discovery"
}

function buildSection(
  section_type: ConversationalPlaybookSectionType,
  items: string[],
  documents: KnowledgeDocument[],
): ConversationalPlaybookSection | null {
  if (items.length === 0) return null
  const citations = toPlaybookCitations(documents.slice(0, 3))
  if (citations.length === 0) return null

  return {
    section_id: `section_${section_type}`,
    section_type,
    title: CONVERSATIONAL_PLAYBOOK_SECTION_LABELS[section_type],
    items,
    citations,
  }
}

function buildSituationSummary(
  playbookType: ConversationalPlaybookType,
  consumer: ConversationalPlaybookConsumer,
  context: KnowledgeConsumerContext,
  query?: string | null,
): string[] {
  const typeLabel = CONVERSATIONAL_PLAYBOOK_TYPE_LABELS[playbookType]
  const docCount = context.documents.length
  const queryNote = query?.trim() ? `Operator query: "${query.trim()}".` : "No specific query provided."

  return [
    `${typeLabel} playbook for ${consumer.replace(/_/g, " ")} — ${docCount} supporting knowledge document(s) matched.`,
    queryNote,
    "Guidance only — operator must review before any outbound action.",
  ]
}

function buildTalkingPoints(context: KnowledgeConsumerContext, playbookType: ConversationalPlaybookType): {
  items: string[]
  documents: KnowledgeDocument[]
} {
  const docs =
    playbookType === "pricing"
      ? context.pricing_notes
      : playbookType === "competitive"
        ? context.competitors
        : playbookType === "objection_handling"
          ? context.objections
          : playbookType === "meeting"
            ? [...context.playbooks, ...context.case_studies]
            : [...context.playbooks, ...context.faqs, ...context.case_studies]

  const items = docs.flatMap((doc) => extractBulletItems(doc, 2)).slice(0, 6)
  return { items, documents: docs }
}

function buildDiscoveryQuestions(context: KnowledgeConsumerContext): {
  items: string[]
  documents: KnowledgeDocument[]
} {
  const docs = [...context.playbooks, ...context.faqs].slice(0, 3)
  const fromDocs = docs.flatMap((doc) =>
    extractBulletItems(doc, 1).filter((item) => /\?/.test(item) || /what|how|who|when|why/i.test(item)),
  )
  const items = [...fromDocs, ...DEFAULT_DISCOVERY_QUESTIONS].slice(0, 5)
  return { items, documents: docs.length ? docs : context.documents.slice(0, 1) }
}

function buildObjectionHandling(context: KnowledgeConsumerContext): {
  items: string[]
  documents: KnowledgeDocument[]
} {
  const docs = [...context.objections, ...context.competitors].slice(0, 4)
  const items = docs.flatMap((doc) => extractBulletItems(doc, 2)).slice(0, 5)
  return { items, documents: docs }
}

function buildQualificationGuidance(context: KnowledgeConsumerContext): {
  items: string[]
  documents: KnowledgeDocument[]
} {
  const docs = [...context.playbooks, ...context.pricing_notes].slice(0, 3)
  const items = [...docs.flatMap((doc) => extractBulletItems(doc, 1)), ...DEFAULT_QUALIFICATION_PROMPTS].slice(0, 5)
  return { items, documents: docs.length ? docs : context.documents.slice(0, 1) }
}

function buildNextSteps(playbookType: ConversationalPlaybookType, consumer: ConversationalPlaybookConsumer): string[] {
  const base = [
    "Review cited knowledge documents before responding.",
    "Confirm human approval for any outbound message or meeting proposal.",
  ]

  switch (playbookType) {
    case "meeting":
      return [...base, "Prepare agenda talking points from meeting prep citations.", "Do not auto-schedule — operator confirms calendar availability."]
    case "objection_handling":
      return [...base, "Acknowledge the concern, cite proof points, and propose a human-reviewed follow-up."]
    case "pricing":
      return [...base, "Route complex pricing to approved pricing notes only.", "Never quote without operator review."]
    case "follow_up":
      return [...base, "Reference prior thread context and cite nurture playbook materials."]
    default:
      return [...base, `Apply ${CONVERSATIONAL_PLAYBOOK_TYPE_LABELS[playbookType]} guidance for ${consumer.replace(/_/g, " ")}.`]
  }
}

function buildRecommendations(
  playbook: Pick<ConversationalPlaybook, "playbook_id" | "playbook_type" | "sections">,
  allCitations: ConversationalPlaybookCitation[],
): ConversationalPlaybookRecommendation[] {
  const recommendations: ConversationalPlaybookRecommendation[] = []

  for (const section of playbook.sections.slice(0, 4)) {
    for (const citation of section.citations.slice(0, 1)) {
      recommendations.push({
        recommendation_id: `rec_${section.section_id}_${citation.document_id}`,
        title: `Review: ${citation.title}`,
        description: `Supporting document for ${section.title.toLowerCase()}.`,
        priority: section.section_type === "objection_handling" ? "high" : "medium",
        citations: [citation],
        action_type: "open_document",
      })
    }
  }

  recommendations.push({
    recommendation_id: `rec_review_${playbook.playbook_id}`,
    title: "Mark playbook reviewed before acting",
    description: "Human review required — no autonomous send, reply, or scheduling.",
    priority: "high",
    citations: allCitations.slice(0, 1),
    action_type: "mark_reviewed",
  })

  return recommendations.slice(0, 8)
}

function channelNotes(consumer: ConversationalPlaybookConsumer): string[] {
  switch (consumer) {
    case "sms":
      return ["SMS: keep messages concise; compliance and opt-out rules apply.", "Never auto-send SMS — operator drafts and approves."]
    case "email":
      return ["Email: use cited proof points; verify deliverability context.", "Never auto-send email — operator drafts and approves."]
    case "voice_drop":
      return ["Voice Drop: script guidance only — execution requires certified campaign linkage.", "Do not trigger voice drop delivery from this playbook."]
    case "call_coaching":
      return ["Live call coaching — operator leads the conversation.", "Use talking points as prompts, not scripts to read verbatim."]
    case "meeting_prep":
      return ["Meeting prep guidance — confirm attendees and agenda with operator.", "Do not auto-book meetings from playbook suggestions."]
    case "operator_inbox":
      return ["Unified inbox context — triage before responding.", "Route to appropriate channel workflow after human review."]
    default:
      return ["Review playbook sections before any outbound action.", "All recommendations require operator approval."]
  }
}

/**
 * Deterministic conversational playbook generation — citation-backed, no LLMs.
 */
export function generateConversationalPlaybook(input: {
  playbook_id: string
  request: ConversationalPlaybookGenerateRequest & { organization_id: string }
  documents: KnowledgeDocument[]
}): ConversationalPlaybook {
  const knowledgeConsumer = CONVERSATIONAL_TO_KNOWLEDGE_CONSUMER[input.request.consumer]

  const context = buildKnowledgeConsumerContextFromDocuments(
    {
      organization_id: input.request.organization_id,
      consumer: knowledgeConsumer,
      categories: input.request.playbook_type ? undefined : undefined,
      tags: undefined,
      industry: input.request.industry ?? undefined,
      company_id: input.request.company_id ?? undefined,
      lead_id: input.request.lead_id ?? undefined,
      query: input.request.query ?? undefined,
      limit: input.request.limit ?? 12,
      include_private: input.request.include_private,
    },
    input.documents,
  )

  const playbook_type = resolveConversationalPlaybookType({
    query: input.request.query,
    context,
    explicit: input.request.playbook_type,
  })

  const sections: ConversationalPlaybookSection[] = []

  const situationDocs = context.documents.slice(0, 2)
  const situation = buildSection(
    "situation_summary",
    buildSituationSummary(playbook_type, input.request.consumer, context, input.request.query),
    situationDocs.length ? situationDocs : context.documents.slice(0, 1),
  )
  if (situation) sections.push(situation)

  const talking = buildTalkingPoints(context, playbook_type)
  const talkingSection = buildSection("talking_points", talking.items, talking.documents)
  if (talkingSection) sections.push(talkingSection)

  const discovery = buildDiscoveryQuestions(context)
  const discoverySection = buildSection("discovery_questions", discovery.items, discovery.documents)
  if (discoverySection) sections.push(discoverySection)

  if (playbook_type === "objection_handling" || context.objections.length > 0) {
    const objections = buildObjectionHandling(context)
    const objectionSection = buildSection("objection_handling", objections.items, objections.documents)
    if (objectionSection) sections.push(objectionSection)
  }

  if (playbook_type === "qualification" || context.pricing_notes.length > 0) {
    const qual = buildQualificationGuidance(context)
    const qualSection = buildSection("qualification_guidance", qual.items, qual.documents)
    if (qualSection) sections.push(qualSection)
  }

  const nextStepDocs = context.documents.slice(0, 2)
  const nextSteps = buildSection(
    "suggested_next_steps",
    buildNextSteps(playbook_type, input.request.consumer),
    nextStepDocs.length ? nextStepDocs : context.documents.slice(0, 1),
  )
  if (nextSteps) sections.push(nextSteps)

  const riskDocs = context.documents.slice(0, 1)
  const risks = buildSection("risks_and_watchouts", [...DEFAULT_RISKS], riskDocs.length ? riskDocs : context.documents.slice(0, 1))
  if (risks) sections.push(risks)

  const allCitations = toPlaybookCitations(context.documents.slice(0, 6))
  const confidence_score = computeConfidence(context, context.documents.length)

  const playbook: ConversationalPlaybook = {
    qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
    playbook_id: input.playbook_id,
    consumer: input.request.consumer,
    playbook_type,
    title: `${CONVERSATIONAL_PLAYBOOK_TYPE_LABELS[playbook_type]} — ${input.request.consumer.replace(/_/g, " ")}`,
    confidence_score,
    review_status: "pending",
    sections,
    recommendations: [],
    citations: allCitations,
    execution_guide: {
      human_review_required: true,
      do_not_autosend: true,
      do_not_auto_reply: true,
      do_not_schedule: true,
      suggested_operator_actions: [
        "Review all cited documents",
        "Mark playbook reviewed before responding",
        "Route to human approval queue when uncertain",
      ],
      channel_notes: channelNotes(input.request.consumer),
    },
    requires_human_review: true,
    autonomous_execution_enabled: false,
    generated_at: new Date().toISOString(),
  }

  playbook.recommendations = buildRecommendations(playbook, allCitations)

  return playbook
}

export function generateConversationalPlaybookFromDocuments(
  request: ConversationalPlaybookGenerateRequest & { organization_id: string },
  documents: KnowledgeDocument[],
  playbook_id?: string,
): ConversationalPlaybook {
  return generateConversationalPlaybook({
    playbook_id: playbook_id ?? `playbook-${request.consumer}-${Date.now()}`,
    request,
    documents,
  })
}
