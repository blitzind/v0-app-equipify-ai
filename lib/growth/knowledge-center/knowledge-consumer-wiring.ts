/** Phase GS-3C — Consumer-specific knowledge wiring (client-safe). */

import type { KnowledgeCategory, KnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-document-types"
import type { KnowledgeConsumer } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"
import type { KnowledgeConsumerContextCounts } from "@/lib/growth/knowledge-center/knowledge-context-types"

function hasCategory(document: KnowledgeDocument, categories: KnowledgeCategory[]): boolean {
  return categories.some((category) => document.categories.includes(category))
}

function hasTagPattern(document: KnowledgeDocument, pattern: RegExp): boolean {
  return document.tags.some((tag) => pattern.test(tag))
}

export function bucketPlaybooks(documents: KnowledgeDocument[]): KnowledgeDocument[] {
  return documents.filter(
    (doc) => hasCategory(doc, ["playbook"]) || hasTagPattern(doc, /playbook|messaging|value_prop|cta|positioning|script|talk_track|discovery|persona|implementation|roi|icp|qualification/),
  )
}

export function bucketObjections(documents: KnowledgeDocument[]): KnowledgeDocument[] {
  return documents.filter((doc) => hasCategory(doc, ["objection"]) || hasTagPattern(doc, /objection|counter|pushback/))
}

export function bucketCompetitors(documents: KnowledgeDocument[]): KnowledgeDocument[] {
  return documents.filter((doc) => hasCategory(doc, ["competitor"]) || hasTagPattern(doc, /competitor|battle.?card|vs/))
}

export function bucketCaseStudies(documents: KnowledgeDocument[]): KnowledgeDocument[] {
  return documents.filter((doc) => hasCategory(doc, ["case_study"]) || hasTagPattern(doc, /case_study|proof|roi/))
}

export function bucketFaqs(documents: KnowledgeDocument[]): KnowledgeDocument[] {
  return documents.filter((doc) => hasCategory(doc, ["faq"]) || doc.source_type === "faq")
}

export function bucketPricingNotes(documents: KnowledgeDocument[]): KnowledgeDocument[] {
  return documents.filter((doc) => hasCategory(doc, ["pricing"]) || hasTagPattern(doc, /pricing|rate|packaging/))
}

export function buildContextCounts(
  documents: KnowledgeDocument[],
  buckets: {
    playbooks: KnowledgeDocument[]
    objections: KnowledgeDocument[]
    competitors: KnowledgeDocument[]
    case_studies: KnowledgeDocument[]
    faqs: KnowledgeDocument[]
    pricing_notes: KnowledgeDocument[]
  },
): KnowledgeConsumerContextCounts {
  return {
    total: documents.length,
    playbooks: buckets.playbooks.length,
    objections: buckets.objections.length,
    competitors: buckets.competitors.length,
    case_studies: buckets.case_studies.length,
    faqs: buckets.faqs.length,
    pricing_notes: buckets.pricing_notes.length,
  }
}

export function buildConsumerSpecificContextMetadata(
  consumer: KnowledgeConsumer,
  counts: KnowledgeConsumerContextCounts,
): Record<string, unknown> {
  switch (consumer) {
    case "prospect_discovery":
      return {
        playbooks_found: counts.playbooks,
        icp_notes_found: counts.playbooks,
        qualification_docs_found: counts.playbooks,
        competitors_found: counts.competitors,
      }
    case "reply_intelligence":
      return {
        faqs_found: counts.faqs,
        objections_found: counts.objections,
        pricing_notes_found: counts.pricing_notes,
        competitors_found: counts.competitors,
      }
    case "meeting_prep":
      return {
        case_studies_found: counts.case_studies,
        objections_found: counts.objections,
        playbooks_found: counts.playbooks,
        competitors_found: counts.competitors,
        pricing_notes_found: counts.pricing_notes,
      }
    case "sequence_builder":
      return {
        playbooks_found: counts.playbooks,
        value_props_found: counts.playbooks,
        proof_points_found: counts.case_studies,
        ctas_found: counts.playbooks,
      }
    case "voice_drop":
      return {
        scripts_found: counts.playbooks,
        positioning_found: counts.playbooks,
        objections_found: counts.objections,
        persona_docs_found: counts.playbooks,
      }
    case "call_coaching":
      return {
        talk_tracks_found: counts.playbooks,
        objections_found: counts.objections,
        discovery_questions_found: counts.playbooks,
        competitors_found: counts.competitors,
      }
    case "opportunity_intelligence":
      return {
        pricing_notes_found: counts.pricing_notes,
        competitive_positioning_found: counts.competitors,
        implementation_playbooks_found: counts.playbooks,
        case_studies_found: counts.case_studies,
        roi_materials_found: counts.case_studies,
      }
    default:
      return { documents_returned: counts.total }
  }
}

export function consumerBucketDocuments(
  consumer: KnowledgeConsumer,
  documents: KnowledgeDocument[],
): {
  playbooks: KnowledgeDocument[]
  objections: KnowledgeDocument[]
  competitors: KnowledgeDocument[]
  case_studies: KnowledgeDocument[]
  faqs: KnowledgeDocument[]
  pricing_notes: KnowledgeDocument[]
} {
  const playbooks = bucketPlaybooks(documents)
  const objections = bucketObjections(documents)
  const competitors = bucketCompetitors(documents)
  const case_studies = bucketCaseStudies(documents)
  const faqs = bucketFaqs(documents)
  const pricing_notes = bucketPricingNotes(documents)

  switch (consumer) {
    case "prospect_discovery":
      return { playbooks, objections: [], competitors, case_studies: [], faqs: [], pricing_notes: [] }
    case "reply_intelligence":
      return { playbooks: [], objections, competitors, case_studies: [], faqs, pricing_notes }
    case "meeting_prep":
      return { playbooks, objections, competitors, case_studies, faqs: [], pricing_notes }
    case "sequence_builder":
      return { playbooks, objections: [], competitors, case_studies, faqs: [], pricing_notes: [] }
    case "voice_drop":
      return { playbooks, objections, competitors, case_studies: [], faqs: [], pricing_notes: [] }
    case "call_coaching":
      return { playbooks, objections, competitors, case_studies: [], faqs: [], pricing_notes: [] }
    case "opportunity_intelligence":
      return { playbooks, objections: [], competitors, case_studies, faqs: [], pricing_notes }
    default:
      return { playbooks, objections, competitors, case_studies, faqs, pricing_notes }
  }
}
