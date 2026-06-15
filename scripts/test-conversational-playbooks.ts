/**
 * Phase GS-3D — Conversational Playbooks certification.
 *
 * Local: pnpm test:conversational-playbooks
 * Production: pnpm test:conversational-playbooks:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  generateConversationalPlaybookFromDocuments,
  resolveConversationalPlaybookType,
} from "../lib/growth/conversational-playbooks/conversational-playbook-engine"
import { buildConversationalPlaybookReadinessPayload } from "../lib/growth/conversational-playbooks/conversational-playbook-route-gates"
import {
  CONVERSATIONAL_PLAYBOOK_CONFIRM,
  CONVERSATIONAL_PLAYBOOK_CONSUMERS,
  CONVERSATIONAL_PLAYBOOK_QA_MARKER,
  CONVERSATIONAL_PLAYBOOK_TYPES,
} from "../lib/growth/conversational-playbooks/conversational-playbook-types"
import { buildKnowledgeConsumerContextFromDocuments } from "../lib/growth/knowledge-center/knowledge-context-injection"
import { ingestKnowledgeDocument } from "../lib/growth/knowledge-center/knowledge-ingestion-service"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const ORG_ID = "00000000-0000-4000-8000-000000000005"

function runLocalRegression(): void {
  console.log(`\n=== GS-3D Conversational Playbooks local regression (${CONVERSATIONAL_PLAYBOOK_QA_MARKER}) ===\n`)

  assert.equal(CONVERSATIONAL_PLAYBOOK_QA_MARKER, "growth-conversational-playbooks-gs3d-v1")
  assert.equal(CONVERSATIONAL_PLAYBOOK_CONFIRM, "RUN_CONVERSATIONAL_PLAYBOOKS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/conversational-playbooks/conversational-playbook-types.ts",
    "lib/growth/conversational-playbooks/conversational-playbook-engine.ts",
    "lib/growth/conversational-playbooks/conversational-playbook-service.ts",
    "lib/growth/conversational-playbooks/conversational-playbook-certification.ts",
    "lib/growth/conversational-playbooks/conversational-playbook-route-gates.ts",
    "app/api/platform/growth/conversational-playbooks/route.ts",
    "app/api/platform/growth/conversational-playbooks/generate/route.ts",
    "app/api/platform/growth/conversational-playbooks/readiness/route.ts",
    "app/api/platform/growth/conversational-playbooks/execute/route.ts",
    "app/api/platform/growth/conversational-playbooks/actions/route.ts",
    "components/growth/growth-conversational-playbooks-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-3D conversational playbooks module files exist")

  const objection = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "ServiceTitan objection handling",
      content: "Objection: We already use ServiceTitan. Ask about integration pain points.",
      tags: ["objection", "competitor"],
      categories: ["objection"],
      status: "active",
    },
    "local-objection",
  ).document

  const playbookDoc = ingestKnowledgeDocument(
    {
      organization_id: ORG_ID,
      source_type: "text",
      title: "HVAC discovery playbook",
      content: "What outcomes matter most? Who evaluates financing solutions?",
      tags: ["playbook", "discovery"],
      categories: ["playbook"],
      status: "active",
    },
    "local-playbook",
  ).document

  const corpus = [objection, playbookDoc]

  for (const playbookType of CONVERSATIONAL_PLAYBOOK_TYPES) {
    const playbook = generateConversationalPlaybookFromDocuments(
      { organization_id: ORG_ID, consumer: "reply_intelligence", playbook_type: playbookType },
      corpus,
      `local-${playbookType}`,
    )
    assert.equal(playbook.playbook_type, playbookType)
    assert.equal(playbook.requires_human_review, true)
    assert.equal(playbook.autonomous_execution_enabled, false)
  }
  console.log("  ✓ all playbook types generated with human review flags")

  for (const consumer of CONVERSATIONAL_PLAYBOOK_CONSUMERS) {
    const playbook = generateConversationalPlaybookFromDocuments(
      { organization_id: ORG_ID, consumer, query: "discovery" },
      corpus,
      `local-consumer-${consumer}`,
    )
    assert.equal(playbook.consumer, consumer)
  }
  console.log("  ✓ all consumers supported")

  const objectionPlaybook = generateConversationalPlaybookFromDocuments(
    { organization_id: ORG_ID, consumer: "reply_intelligence", query: "ServiceTitan objection" },
    corpus,
    "local-objection-playbook",
  )
  assert.ok(objectionPlaybook.sections.length > 0)
  assert.ok(objectionPlaybook.sections.every((s) => s.citations.length > 0))
  assert.ok(objectionPlaybook.citations.length > 0)
  console.log("  ✓ citation-backed sections")

  const context = buildKnowledgeConsumerContextFromDocuments(
    { organization_id: ORG_ID, consumer: "reply_intelligence", query: "pricing budget" },
    corpus,
  )
  assert.equal(resolveConversationalPlaybookType({ query: "pricing budget", context }), "pricing")
  console.log("  ✓ deterministic playbook type resolution")

  const detA = generateConversationalPlaybookFromDocuments(
    { organization_id: ORG_ID, consumer: "call_coaching", query: "discovery" },
    corpus,
    "det-a",
  )
  const detB = generateConversationalPlaybookFromDocuments(
    { organization_id: ORG_ID, consumer: "call_coaching", query: "discovery" },
    corpus,
    "det-b",
  )
  assert.equal(detA.confidence_score, detB.confidence_score)
  assert.equal(detA.sections.length, detB.sections.length)
  console.log("  ✓ deterministic generation")

  const readiness = buildConversationalPlaybookReadinessPayload()
  assert.equal(readiness.no_message_send, true)
  assert.equal(readiness.no_auto_reply, true)
  assert.equal(readiness.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics — no message send or auto-reply")

  const generateRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/conversational-playbooks/generate/route.ts"),
    "utf8",
  )
  assert.ok(generateRoute.includes("outreach_enabled: false"))
  assert.ok(!generateRoute.includes("sendMessage"))
  assert.ok(!generateRoute.includes("executeOutreach"))
  console.log("  ✓ generate API — guidance only")

  const executeRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/conversational-playbooks/execute/route.ts"),
    "utf8",
  )
  assert.ok(executeRoute.includes("executeConversationalPlaybooksCertification"))
  console.log("  ✓ execute API — certification only")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-conversational-playbooks-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("View Playbook"))
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(uiSource.includes("openDocument") || uiSource.includes("ExternalLink"))
  assert.ok(!uiSource.match(/\bSend\b/))
  assert.ok(!uiSource.includes("Auto-reply"))
  assert.ok(!uiSource.includes("Launch"))
  assert.ok(!uiSource.includes("Enroll"))
  assert.ok(!uiSource.includes("Book Meeting"))
  console.log("  ✓ UI — human-gated actions only")

  const engineSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/conversational-playbooks/conversational-playbook-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  assert.ok(!engineSource.includes("vectorStore"))
  console.log("  ✓ engine — no LLM, embeddings, or vector DB")

  console.log("\nGS-3D Conversational Playbooks local regression PASS\n")
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
  const { executeConversationalPlaybooksCertification } = await import(
    "../lib/growth/conversational-playbooks/conversational-playbook-certification"
  )
  return executeConversationalPlaybooksCertification(admin, {})
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
          qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
          hint: "Run pnpm test:conversational-playbooks:production for production certification",
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
