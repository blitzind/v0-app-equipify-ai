/**
 * FUZOR-ADOPTION-1E — GS-3 Knowledge Center service delegation parity.
 * Run: pnpm test:fuzor-adoption-1e-knowledge-service-parity
 */
import assert from "node:assert/strict"

import {
  classifyPlatformKnowledgeDocument,
  ingestPlatformKnowledgeDocument,
  searchPlatformKnowledge,
  retrievePlatformKnowledgeForConsumer,
  buildPlatformKnowledgeConsumerContextFromDocuments,
  generatePlatformKnowledgeRecommendations,
  generatePlatformKnowledgeRecommendationsFromDocuments,
  buildPlatformKnowledgeCitations,
  assertAllPlatformKnowledgeRecommendationsCited,
  PLATFORM_KNOWLEDGE_CENTER_QA_MARKER,
  resolvePlatformKnowledgeOrganizationId,
} from "@fuzor/knowledge"

import { classifyKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-classification"
import { ingestKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-ingestion-service"
import { searchKnowledge } from "../lib/growth/knowledge-center/knowledge-search"
import { retrieveKnowledgeForConsumer } from "../lib/growth/knowledge-center/knowledge-consumer-adapters"
import { buildKnowledgeConsumerContextFromDocuments } from "../lib/growth/knowledge-center/knowledge-context-injection"
import {
  generateKnowledgeRecommendations,
  generateKnowledgeRecommendationsFromDocuments,
} from "../lib/growth/knowledge-center/knowledge-recommendation-engine"
import {
  assertAllRecommendationsCited,
  buildKnowledgeCitations,
} from "../lib/growth/knowledge-center/knowledge-citation-builder"
import { KNOWLEDGE_CENTER_QA_MARKER } from "../lib/growth/knowledge-center/knowledge-document-types"
import { KNOWLEDGE_CONSUMERS } from "../lib/growth/knowledge-center/knowledge-retrieval-types"
import {
  ensureKnowledgeOrganizationBootstrap,
  resolveKnowledgeOrganizationId,
} from "../lib/growth/knowledge-center/knowledge-org-bootstrap"

const TEST_ORG = "00000000-0000-4000-8000-000000000001"
const OTHER_ORG = "00000000-0000-4000-8000-000000000002"
const ENV_ORG = "11111111-1111-4111-8111-111111111111"

console.log("[FUZOR-ADOPTION-1E] GS-3 Knowledge Center service delegation parity")

assert.strictEqual(classifyKnowledgeDocument, classifyPlatformKnowledgeDocument)
assert.strictEqual(ingestKnowledgeDocument, ingestPlatformKnowledgeDocument)
assert.strictEqual(searchKnowledge, searchPlatformKnowledge)
assert.strictEqual(retrieveKnowledgeForConsumer, retrievePlatformKnowledgeForConsumer)
assert.strictEqual(
  buildKnowledgeConsumerContextFromDocuments,
  buildPlatformKnowledgeConsumerContextFromDocuments,
)
assert.strictEqual(
  generateKnowledgeRecommendations,
  generatePlatformKnowledgeRecommendations,
)
assert.strictEqual(
  generateKnowledgeRecommendationsFromDocuments,
  generatePlatformKnowledgeRecommendationsFromDocuments,
)
assert.strictEqual(buildKnowledgeCitations, buildPlatformKnowledgeCitations)
assert.strictEqual(assertAllRecommendationsCited, assertAllPlatformKnowledgeRecommendationsCited)
assert.strictEqual(KNOWLEDGE_CENTER_QA_MARKER, PLATFORM_KNOWLEDGE_CENTER_QA_MARKER)

const originalEnvOrg = process.env.GROWTH_ENGINE_AI_ORG_ID
delete process.env.GROWTH_ENGINE_AI_ORG_ID

assert.equal(resolveKnowledgeOrganizationId(undefined), null)
assert.equal(ensureKnowledgeOrganizationBootstrap(undefined), null)
assert.equal(resolvePlatformKnowledgeOrganizationId(undefined), null)

process.env.GROWTH_ENGINE_AI_ORG_ID = ENV_ORG
assert.equal(resolveKnowledgeOrganizationId(undefined), ENV_ORG)
assert.equal(resolveKnowledgeOrganizationId(TEST_ORG), TEST_ORG)
assert.equal(resolveKnowledgeOrganizationId(null), ENV_ORG)
assert.equal(resolvePlatformKnowledgeOrganizationId(undefined), null)

delete process.env.GROWTH_ENGINE_AI_ORG_ID
assert.equal(resolveKnowledgeOrganizationId(undefined), null)

process.env.GROWTH_ENGINE_AI_ORG_ID = ENV_ORG
assert.equal(resolveKnowledgeOrganizationId(undefined), ENV_ORG)
process.env.GROWTH_ENGINE_AI_ORG_ID = OTHER_ORG
assert.equal(resolveKnowledgeOrganizationId(undefined), OTHER_ORG)

delete process.env.GROWTH_ENGINE_AI_ORG_ID
assert.equal(resolveKnowledgeOrganizationId(undefined), null)
assert.equal(resolvePlatformKnowledgeOrganizationId(undefined), null)

const fixtureInput = {
  source_type: "text" as const,
  title: "Objection handling",
  content: "Objection handling for budget concerns in competitive deals.",
  tags: ["objection"],
  status: "active" as const,
  organization_id: TEST_ORG,
}

const equipifyIngest = ingestKnowledgeDocument(fixtureInput, "doc-parity-1", {
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
})
assert.equal(equipifyIngest.document.knowledge_document_id, "doc-parity-1")
assert.equal(equipifyIngest.classification.category, "objection")

const corpus = [
  equipifyIngest.document,
  ingestKnowledgeDocument(
    {
      source_type: "url",
      title: "Pricing",
      source_url: "https://example.com/pricing",
      content: "Pricing plans and packaging details.",
      tags: ["pricing"],
      status: "active",
      organization_id: TEST_ORG,
    },
    "doc-pricing",
    { created_at: "2026-01-02T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z" },
  ).document,
  ingestKnowledgeDocument(
    {
      source_type: "file",
      title: "Battle Card",
      source_filename: "incumbent-battle-card.pdf",
      content: "Competitor battle card vs incumbent platform.",
      status: "active",
      organization_id: OTHER_ORG,
    },
    "doc-competitor",
    { created_at: "2026-01-03T00:00:00.000Z", updated_at: "2026-01-03T00:00:00.000Z" },
  ).document,
]

const equipifySearch = searchKnowledge(corpus, {
  query: "incumbent",
  organization_id: OTHER_ORG,
  limit: 10,
})
assert.equal(equipifySearch.total, 1)
assert.equal(equipifySearch.hits[0]?.document.knowledge_document_id, "doc-competitor")

const equipifyRetrieval = retrieveKnowledgeForConsumer(corpus, {
  organization_id: OTHER_ORG,
  consumer: "sequence_builder",
  query: "incumbent",
  limit: 5,
})
assert.equal(typeof equipifyRetrieval.relevance_score, "number")

const equipifyContext = buildKnowledgeConsumerContextFromDocuments(
  {
    organization_id: TEST_ORG,
    consumer: "reply_intelligence",
    query: "objection",
    limit: 5,
  },
  corpus,
)
assert.ok(equipifyContext.documents.length >= 1)

const equipifyRecommendations = generateKnowledgeRecommendations(equipifyContext, {
  query: "objection",
  limit: 5,
})
assert.equal(assertAllRecommendationsCited(equipifyRecommendations.recommendations), true)

const equipifyCitations = buildKnowledgeCitations(corpus.slice(0, 1))
assert.equal(equipifyCitations.length, 1)

assert.equal(KNOWLEDGE_CONSUMERS.includes("sequence_builder"), true)

if (originalEnvOrg === undefined) {
  delete process.env.GROWTH_ENGINE_AI_ORG_ID
} else {
  process.env.GROWTH_ENGINE_AI_ORG_ID = originalEnvOrg
}

console.log("[FUZOR-ADOPTION-1E] PASS — Equipify knowledge-org-bootstrap adapter + platform delegation parity")
