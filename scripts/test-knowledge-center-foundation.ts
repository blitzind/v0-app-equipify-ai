/**
 * Phase GS-3A — Knowledge Center foundation certification.
 *
 * Local: pnpm test:knowledge-center-foundation
 * Production: pnpm test:knowledge-center-foundation:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { classifyKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-classification"
import { ingestKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-ingestion-service"
import { searchKnowledge } from "../lib/growth/knowledge-center/knowledge-search"
import {
  KNOWLEDGE_CENTER_CONFIRM,
  KNOWLEDGE_CENTER_QA_MARKER,
} from "../lib/growth/knowledge-center/knowledge-document-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-3A local regression (${KNOWLEDGE_CENTER_QA_MARKER}) ===\n`)

  assert.equal(KNOWLEDGE_CENTER_QA_MARKER, "growth-knowledge-center-gs3a-v1")
  assert.equal(KNOWLEDGE_CENTER_CONFIRM, "RUN_KNOWLEDGE_CENTER_FOUNDATION_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/knowledge-center/knowledge-document-types.ts",
    "lib/growth/knowledge-center/knowledge-ingestion-service.ts",
    "lib/growth/knowledge-center/knowledge-repository.ts",
    "lib/growth/knowledge-center/knowledge-classification.ts",
    "lib/growth/knowledge-center/knowledge-search.ts",
    "lib/growth/knowledge-center/knowledge-certification.ts",
    "app/api/platform/growth/knowledge/documents/route.ts",
    "app/api/platform/growth/knowledge/search/route.ts",
    "app/api/platform/growth/knowledge/classify/route.ts",
    "components/growth/growth-knowledge-center-dashboard.tsx",
    "app/(admin)/admin/growth/knowledge/page.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-3A module files exist")

  const url = ingestKnowledgeDocument(
    {
      source_type: "url",
      title: "Equipify Pricing",
      source_url: "https://equipify.ai/pricing",
      content: "Pricing plans and packaging details.",
    },
    "local-url",
  )
  assert.equal(url.classification.category, "pricing")
  console.log("  ✓ URL ingestion + classification")

  const file = ingestKnowledgeDocument(
    {
      source_type: "file",
      title: "Battle Card",
      source_filename: "servicetitan-battle-card.pdf",
      content: "Competitor battle card vs ServiceTitan.",
    },
    "local-file",
  )
  assert.equal(file.classification.category, "competitor")
  console.log("  ✓ file ingestion")

  const faq = ingestKnowledgeDocument(
    {
      source_type: "faq",
      title: "Comparison FAQ",
      faq_question: "How does Equipify compare to ServiceTitan?",
      faq_answer: "Equipify emphasizes revenue execution.",
    },
    "local-faq",
  )
  assert.equal(faq.classification.category, "faq")
  console.log("  ✓ FAQ ingestion")

  const note = ingestKnowledgeDocument(
    {
      source_type: "text",
      title: "Objection note",
      content: "Objection handling for budget concerns.",
      tags: ["objection"],
    },
    "local-note",
  )
  assert.equal(note.classification.category, "objection")
  console.log("  ✓ note ingestion")

  const classification = classifyKnowledgeDocument({
    title: "Call coaching guide",
    content: "Call script and voicemail coaching notes.",
    source_type: "text",
  })
  assert.equal(classification.category, "call")
  console.log("  ✓ classification engine")

  const search = searchKnowledge([url.document, file.document, faq.document, note.document], {
    query: "ServiceTitan",
    limit: 10,
  })
  assert.ok(search.total >= 1)
  console.log("  ✓ keyword search")

  const tagSearch = searchKnowledge([url.document], { tags: ["pricing"], limit: 10 })
  assert.ok(tagSearch.total >= 1)
  console.log("  ✓ tag search")

  const categorySearch = searchKnowledge([file.document], { category: "competitor", limit: 10 })
  assert.ok(categorySearch.total >= 1)
  console.log("  ✓ category search")

  const documentsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/knowledge/documents/route.ts"),
    "utf8",
  )
  assert.ok(documentsRoute.includes("createKnowledgeDocument"))
  assert.ok(!documentsRoute.includes("openai"))
  assert.ok(!documentsRoute.includes("generateContent"))
  console.log("  ✓ APIs — ingestion only, no autonomous generation")

  console.log("\nGS-3A local regression PASS\n")
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
  const { executeKnowledgeCenterFoundationCertification } = await import(
    "../lib/growth/knowledge-center/knowledge-certification"
  )
  return executeKnowledgeCenterFoundationCertification(admin, {})
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
          qa_marker: KNOWLEDGE_CENTER_QA_MARKER,
          hint: "Run pnpm test:knowledge-center-foundation:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-3A production certification (${KNOWLEDGE_CENTER_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
