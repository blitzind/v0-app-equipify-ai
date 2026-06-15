/**
 * Phase GS-3B — Knowledge retrieval layer certification.
 *
 * Local: pnpm test:knowledge-retrieval-layer
 * Production: pnpm test:knowledge-retrieval-layer:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { ingestKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-ingestion-service"
import {
  buildConsumerContext,
  retrieveKnowledgeForConsumer,
} from "../lib/growth/knowledge-center/knowledge-consumer-adapters"
import {
  retrieveKnowledge,
  scoreKnowledgeDocumentRelevance,
} from "../lib/growth/knowledge-center/knowledge-retrieval-service"
import {
  KNOWLEDGE_CONSUMERS,
  KNOWLEDGE_RETRIEVAL_CONFIRM,
  KNOWLEDGE_RETRIEVAL_QA_MARKER,
} from "../lib/growth/knowledge-center/knowledge-retrieval-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const ORG_ID = "00000000-0000-4000-8000-000000000001"

function runLocalRegression(): void {
  console.log(`\n=== GS-3B local regression (${KNOWLEDGE_RETRIEVAL_QA_MARKER}) ===\n`)

  assert.equal(KNOWLEDGE_RETRIEVAL_QA_MARKER, "growth-knowledge-retrieval-gs3b-v1")
  assert.equal(KNOWLEDGE_RETRIEVAL_CONFIRM, "RUN_KNOWLEDGE_RETRIEVAL_LAYER_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/knowledge-center/knowledge-retrieval-types.ts",
    "lib/growth/knowledge-center/knowledge-retrieval-service.ts",
    "lib/growth/knowledge-center/knowledge-consumer-adapters.ts",
    "lib/growth/knowledge-center/knowledge-retrieval-certification.ts",
    "app/api/platform/growth/knowledge/retrieve/route.ts",
    "app/api/platform/growth/knowledge/retrieve/execute/route.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-3B module files exist")

  const active = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "ServiceTitan objection handling for HVAC",
      content: "Objection counter for ServiceTitan in HVAC industry.",
      tags: ["objection", "hvac"],
      categories: ["objection", "competitor"],
      status: "active",
      visibility: "organization",
    },
    "active-doc",
  ).document

  const draft = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "Draft doc",
      content: "draft",
      status: "draft",
    },
    "draft-doc",
  ).document

  const archived = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "Archived doc",
      content: "archived",
      status: "archived",
    },
    "archived-doc",
  ).document

  const review = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "Review doc",
      content: "review",
      status: "active",
      metadata: { knowledge_review_status: "review" },
    },
    "review-doc",
  ).document

  const privateDoc = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "Private note",
      content: "Private objection",
      tags: ["objection"],
      categories: ["objection"],
      status: "active",
      visibility: "private",
      metadata: { lead_id: "lead-1" },
    },
    "private-doc",
  ).document

  const corpus = [active, draft, archived, review, privateDoc]
  const request = {
    organization_id: ORG_ID,
    consumer: "reply_intelligence" as const,
    query: "ServiceTitan",
    categories: ["objection"],
    tags: ["hvac"],
    limit: 10,
  }

  const result = retrieveKnowledgeForConsumer(corpus, request)
  assert.ok(result.documents.some((doc) => doc.knowledge_document_id === "active-doc"))
  assert.ok(!result.documents.some((doc) => doc.knowledge_document_id === "draft-doc"))
  assert.ok(!result.documents.some((doc) => doc.knowledge_document_id === "archived-doc"))
  assert.ok(!result.documents.some((doc) => doc.knowledge_document_id === "review-doc"))
  console.log("  ✓ active-only retrieval; draft/archived/review excluded")

  assert.ok(result.relevance_score >= 40)
  console.log("  ✓ title/keyword relevance scoring")

  const orgOnly = retrieveKnowledgeForConsumer(corpus, { ...request, include_private: false })
  assert.ok(orgOnly.documents.every((doc) => doc.visibility === "organization"))
  console.log("  ✓ organization visibility")

  const withPrivate = retrieveKnowledgeForConsumer(corpus, {
    ...request,
    include_private: true,
    lead_id: "lead-1",
  })
  assert.ok(withPrivate.documents.some((doc) => doc.knowledge_document_id === "private-doc"))
  console.log("  ✓ private visibility with lead scope")

  const scoredA = scoreKnowledgeDocumentRelevance(active, request, ["objection"], ["hvac"])
  const scoredB = scoreKnowledgeDocumentRelevance(active, request, ["objection"], ["hvac"])
  assert.equal(scoredA.relevance_score, scoredB.relevance_score)
  console.log("  ✓ deterministic scoring")

  for (const consumer of KNOWLEDGE_CONSUMERS) {
    const consumerResult = retrieveKnowledgeForConsumer(corpus, {
      organization_id: ORG_ID,
      consumer,
      limit: 10,
    })
    const context = buildConsumerContext(consumer, consumerResult.documents)
    assert.equal(typeof context.documents_returned, "number")
  }
  console.log("  ✓ consumer adapters return scoped context")

  const retrieveRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/knowledge/retrieve/route.ts"),
    "utf8",
  )
  assert.ok(retrieveRoute.includes("runKnowledgeRetrieval"))
  assert.ok(!retrieveRoute.includes("openai"))
  assert.ok(!retrieveRoute.includes("embedding"))
  assert.ok(!retrieveRoute.includes("vector"))
  console.log("  ✓ retrieval API — no LLM/vector dependency")

  console.log("\nGS-3B local regression PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  process.env.VERCEL_ENV = process.env.VERCEL_ENV ?? "production"

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeKnowledgeRetrievalLayerCertification } = await import(
    "../lib/growth/knowledge-center/knowledge-retrieval-certification"
  )
  return executeKnowledgeRetrievalLayerCertification(admin, {})
}

async function main(): Promise<void> {
  const productionOnly = process.argv.includes("--production")
  runLocalRegression()

  if (!productionOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: KNOWLEDGE_RETRIEVAL_QA_MARKER,
          hint: "Run pnpm test:knowledge-retrieval-layer:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-3B production certification (${KNOWLEDGE_RETRIEVAL_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
