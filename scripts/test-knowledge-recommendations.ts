/**
 * Phase GS-3D — Knowledge-augmented copilot recommendations certification.
 *
 * Local: pnpm test:knowledge-recommendations
 * Production: pnpm test:knowledge-recommendations:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { assertAllRecommendationsCited, buildKnowledgeCitations } from "../lib/growth/knowledge-center/knowledge-citation-builder"
import { ingestKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-ingestion-service"
import {
  generateKnowledgeRecommendations,
  generateKnowledgeRecommendationsFromDocuments,
} from "../lib/growth/knowledge-center/knowledge-recommendation-engine"
import { buildKnowledgeConsumerContextFromDocuments } from "../lib/growth/knowledge-center/knowledge-context-injection"
import {
  KNOWLEDGE_RECOMMENDATION_CONFIRM,
  KNOWLEDGE_RECOMMENDATION_QA_MARKER,
} from "../lib/growth/knowledge-center/knowledge-recommendation-types"
import { KNOWLEDGE_CONSUMERS } from "../lib/growth/knowledge-center/knowledge-retrieval-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const ORG_ID = "00000000-0000-4000-8000-000000000003"

function runLocalRegression(): void {
  console.log(`\n=== GS-3D local regression (${KNOWLEDGE_RECOMMENDATION_QA_MARKER}) ===\n`)

  assert.equal(KNOWLEDGE_RECOMMENDATION_QA_MARKER, "growth-knowledge-recommendations-gs3d-v1")
  assert.equal(KNOWLEDGE_RECOMMENDATION_CONFIRM, "RUN_KNOWLEDGE_RECOMMENDATIONS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/knowledge-center/knowledge-recommendation-types.ts",
    "lib/growth/knowledge-center/knowledge-recommendation-engine.ts",
    "lib/growth/knowledge-center/knowledge-citation-builder.ts",
    "lib/growth/knowledge-center/knowledge-recommendation-certification.ts",
    "lib/growth/knowledge-center/knowledge-recommendation-service.ts",
    "app/api/platform/growth/knowledge/recommendations/route.ts",
    "app/api/platform/growth/knowledge/recommendations/generate/route.ts",
    "components/growth/growth-knowledge-recommendations-section.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-3D module files exist")

  const activeObjection = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "ServiceTitan objection handling",
      content: "Objection: We already use ServiceTitan.",
      tags: ["objection", "competitor", "hvac"],
      categories: ["objection", "competitor"],
      status: "active",
    },
    "active-objection",
  ).document

  const activePricing = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "HVAC pricing note",
      content: "Pricing guidance for HVAC teams.",
      tags: ["pricing"],
      categories: ["pricing"],
      status: "active",
    },
    "active-pricing",
  ).document

  const draft = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "Draft excluded",
      content: "draft",
      status: "draft",
    },
    "draft-doc",
  ).document

  const corpus = [activeObjection, activePricing, draft]

  const context = buildKnowledgeConsumerContextFromDocuments(
    {
      organization_id: ORG_ID,
      consumer: "reply_intelligence",
      query: "ServiceTitan",
      limit: 10,
    },
    corpus,
  )

  const result = generateKnowledgeRecommendations(context, { query: "ServiceTitan" })
  assert.ok(result.recommendations.length >= 1)
  assert.ok(assertAllRecommendationsCited(result.recommendations))
  assert.ok(!result.recommendations.some((rec) => rec.citations.some((c) => c.document_id === "draft-doc")))
  console.log("  ✓ recommendations generated with citations; draft excluded")

  const citations = buildKnowledgeCitations([activeObjection])
  assert.equal(citations[0]?.document_id, "active-objection")
  assert.equal(citations[0]?.title, activeObjection.title)
  assert.ok(citations[0]?.category)
  console.log("  ✓ citation builder attaches document_id, title, category")

  const deterministicA = generateKnowledgeRecommendations(context, { query: "ServiceTitan" })
  const deterministicB = generateKnowledgeRecommendations(context, { query: "ServiceTitan" })
  assert.deepEqual(
    deterministicA.recommendations.map((rec) => rec.confidence),
    deterministicB.recommendations.map((rec) => rec.confidence),
  )
  assert.deepEqual(
    deterministicA.recommendations.map((rec) => rec.priority),
    deterministicB.recommendations.map((rec) => rec.priority),
  )
  console.log("  ✓ confidence and priority deterministic")

  for (const consumer of KNOWLEDGE_CONSUMERS) {
    const consumerResult = generateKnowledgeRecommendationsFromDocuments(
      { organization_id: ORG_ID, consumer, query: "ServiceTitan", limit: 10 },
      corpus,
    )
    assert.equal(consumerResult.consumer, consumer)
    assert.ok(assertAllRecommendationsCited(consumerResult.recommendations))
  }
  console.log("  ✓ all 7 consumers return recommendations")

  assert.equal(result.autonomous_execution_enabled, false)
  assert.equal(result.requires_human_review, true)
  console.log("  ✓ no autonomous execution")

  const generateRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/knowledge/recommendations/generate/route.ts"),
    "utf8",
  )
  assert.ok(generateRoute.includes("generateKnowledgeRecommendationsForRequest"))
  assert.ok(!generateRoute.includes("openai"))
  assert.ok(!generateRoute.includes("embedding"))
  console.log("  ✓ recommendation API — no LLM/vector dependency")

  const uiSection = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-knowledge-recommendations-section.tsx"),
    "utf8",
  )
  assert.ok(uiSection.includes("Mark Reviewed"))
  assert.ok(uiSection.includes("View Document"))
  assert.ok(!uiSection.includes("Send"))
  assert.ok(!uiSection.includes("Execute"))
  console.log("  ✓ UI has review actions only — no send/execute buttons")

  console.log("\nGS-3D local regression PASS\n")
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
  const { executeKnowledgeRecommendationsCertification } = await import(
    "../lib/growth/knowledge-center/knowledge-recommendation-certification"
  )
  return executeKnowledgeRecommendationsCertification(admin, {})
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
          qa_marker: KNOWLEDGE_RECOMMENDATION_QA_MARKER,
          hint: "Run pnpm test:knowledge-recommendations:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
