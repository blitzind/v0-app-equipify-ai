/**
 * Phase GS-3C — Knowledge context injection certification.
 *
 * Local: pnpm test:knowledge-context-injection
 * Production: pnpm test:knowledge-context-injection:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { ingestKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-ingestion-service"
import { buildKnowledgeConsumerContextFromDocuments } from "../lib/growth/knowledge-center/knowledge-context-injection"
import {
  KNOWLEDGE_CONTEXT_CONFIRM,
  KNOWLEDGE_CONTEXT_QA_MARKER,
} from "../lib/growth/knowledge-center/knowledge-context-types"
import { KNOWLEDGE_CONSUMERS } from "../lib/growth/knowledge-center/knowledge-retrieval-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const ORG_ID = "00000000-0000-4000-8000-000000000002"

function runLocalRegression(): void {
  console.log(`\n=== GS-3C local regression (${KNOWLEDGE_CONTEXT_QA_MARKER}) ===\n`)

  assert.equal(KNOWLEDGE_CONTEXT_QA_MARKER, "growth-knowledge-context-gs3c-v1")
  assert.equal(KNOWLEDGE_CONTEXT_CONFIRM, "RUN_KNOWLEDGE_CONTEXT_INJECTION_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/knowledge-center/knowledge-context-types.ts",
    "lib/growth/knowledge-center/knowledge-context-injection.ts",
    "lib/growth/knowledge-center/knowledge-consumer-wiring.ts",
    "lib/growth/knowledge-center/knowledge-context-service.ts",
    "lib/growth/knowledge-center/knowledge-context-certification.ts",
    "app/api/platform/growth/knowledge/context/route.ts",
    "components/growth/growth-knowledge-context-section.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-3C module files exist")

  const active = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "faq",
      title: "ServiceTitan comparison FAQ",
      faq_question: "How does Equipify compare to ServiceTitan?",
      faq_answer: "Faster rollout and revenue execution focus.",
      tags: ["faq", "competitor", "hvac"],
      categories: ["faq", "competitor"],
      status: "active",
    },
    "active-faq",
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

  const corpus = [active, draft]

  const reply = buildKnowledgeConsumerContextFromDocuments(
    {
      organization_id: ORG_ID,
      consumer: "reply_intelligence",
      query: "ServiceTitan",
      limit: 10,
    },
    corpus,
  )

  assert.ok(reply.documents.some((doc) => doc.knowledge_document_id === "active-faq"))
  assert.ok(!reply.documents.some((doc) => doc.knowledge_document_id === "draft-doc"))
  assert.ok(reply.counts.faqs >= 1)
  console.log("  ✓ active context injected; draft excluded")

  for (const consumer of KNOWLEDGE_CONSUMERS) {
    const ctx = buildKnowledgeConsumerContextFromDocuments(
      { organization_id: ORG_ID, consumer, limit: 10 },
      corpus,
    )
    assert.equal(typeof ctx.consumer_context, "object")
  }
  console.log("  ✓ all consumer adapters return context")

  const contextRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/knowledge/context/route.ts"),
    "utf8",
  )
  assert.ok(contextRoute.includes("injectKnowledgeContext"))
  assert.ok(!contextRoute.includes("openai"))
  assert.ok(!contextRoute.includes("embedding"))
  console.log("  ✓ context API — no LLM/vector dependency")

  console.log("\nGS-3C local regression PASS\n")
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
  const { executeKnowledgeContextInjectionCertification } = await import(
    "../lib/growth/knowledge-center/knowledge-context-certification"
  )
  return executeKnowledgeContextInjectionCertification(admin, {})
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
          qa_marker: KNOWLEDGE_CONTEXT_QA_MARKER,
          hint: "Run pnpm test:knowledge-context-injection:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-3C production certification (${KNOWLEDGE_CONTEXT_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
