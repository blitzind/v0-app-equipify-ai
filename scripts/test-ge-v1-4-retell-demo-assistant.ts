/**
 * GE-v1-4 — Retell Conversational Demo Assistant certification.
 *
 * Local: pnpm test:ge-v1-4-retell-demo-assistant
 * Production: pnpm test:ge-v1-4-retell-demo-assistant:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  resolveBestKnowledgeTopic,
  resolveBundleAnswer,
} from "../lib/growth/demo-assistant/equipify-demo-knowledge-bundle-v1"
import {
  detectDemoAssistantIntent,
  buildConversationOutcome,
} from "../lib/growth/demo-assistant/ge-v1-4-demo-intent-service"
import {
  GE_V1_4_DEMO_ASSISTANT_CONFIRM,
  GE_V1_4_DEMO_ASSISTANT_QA_MARKER,
  GE_V1_4_DEFAULT_BOOKING_PATH,
} from "../lib/growth/demo-assistant/ge-v1-4-types"
import { generateGeV14DemoAssistantRecommendations } from "../lib/growth/demo-assistant/ge-v1-4-demo-recommendation-rules"
import { buildGeV14RetellProviderReadinessReport } from "../lib/growth/demo-assistant/ge-v1-4-retell-provider-readiness"
import { GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES } from "../lib/growth/sendr/growth-sendr-config"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/demo-assistant/ge-v1-4-types.ts",
  "lib/growth/demo-assistant/equipify-demo-knowledge-bundle-v1.ts",
  "lib/growth/demo-assistant/ge-v1-4-prospect-context.ts",
  "lib/growth/demo-assistant/ge-v1-4-demo-intent-service.ts",
  "lib/growth/demo-assistant/ge-v1-4-demo-assistant-answer-service.ts",
  "lib/growth/demo-assistant/ge-v1-4-retell-demo-provider.ts",
  "lib/growth/demo-assistant/ge-v1-4-retell-provider-readiness.ts",
  "lib/growth/demo-assistant/ge-v1-4-demo-session-repository.ts",
  "lib/growth/demo-assistant/ge-v1-4-demo-session-service.ts",
  "lib/growth/demo-assistant/ge-v1-4-demo-analytics.ts",
  "lib/growth/demo-assistant/ge-v1-4-demo-recommendations.ts",
  "app/api/public/demo-assistant/[slug]/session/route.ts",
  "app/api/public/demo-assistant/[slug]/ask/route.ts",
  "app/api/public/demo-assistant/[slug]/complete/route.ts",
  "app/api/growth/demo-assistant/provider-readiness/route.ts",
  "components/growth/demo-assistant/growth-demo-assistant-widget.tsx",
  "supabase/migrations/20270924120000_ge_v1_4_demo_assistant_sessions.sql",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/sendr/growth-sendr-public-engagement-service.ts",
  "lib/growth/sendr/growth-sendr-recommendation-service.ts",
  "lib/growth/sendr/growth-sendr-timeline-intelligence-service.ts",
  "components/sendr/sendr-public-page-client.tsx",
  "components/growth/sendr/presentation/sendr-public-presentation-layout.tsx",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GE-v1-4 Retell Demo Assistant (${GE_V1_4_DEMO_ASSISTANT_QA_MARKER}) ===\n`)

  assert.equal(GE_V1_4_DEMO_ASSISTANT_QA_MARKER, "ge-v1-4-retell-demo-assistant-v1")
  assert.equal(GE_V1_4_DEMO_ASSISTANT_CONFIRM, "RUN_GE_V1_4_RETELL_DEMO_ASSISTANT_CERTIFICATION")
  assert.equal(GE_V1_4_DEFAULT_BOOKING_PATH, "/book/equipify-demo")
  console.log("  ✓ QA marker, confirm token, default booking path")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} GE-v1-4 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270924120000_ge_v1_4_demo_assistant_sessions.sql"),
    "utf8",
  )
  assert.match(migration, /demo_assistant_sessions/)
  assert.match(migration, /question_asked/)
  assert.match(migration, /conversation_completed/)
  assert.match(migration, /demo_assistant_enabled/)
  console.log("  ✓ Migration defines sessions, event types, kill switch")

  for (const eventType of [
    "agent_opened",
    "question_asked",
    "response_generated",
    "booking_offered",
    "booking_started",
    "booking_completed",
    "conversation_completed",
  ] as const) {
    assert.ok(
      (GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES as readonly string[]).includes(eventType),
      `Missing engagement event type: ${eventType}`,
    )
  }
  console.log("  ✓ SENDR engagement event types extended")

  const quickbooksTopic = resolveBestKnowledgeTopic("Does Equipify integrate with QuickBooks?")
  assert.equal(quickbooksTopic?.topicId, "quickbooks-integration")
  const quickbooksAnswer = resolveBundleAnswer("Does Equipify integrate with QuickBooks?", {
    company: "Acme HVAC",
    bookingUrl: "/book/equipify-demo",
  })
  assert.match(quickbooksAnswer.answer.toLowerCase(), /quickbooks/)
  assert.match(quickbooksAnswer.answer, /Acme HVAC/)
  console.log("  ✓ QuickBooks knowledge bundle answer")

  const pricingIntent = detectDemoAssistantIntent("How much does Equipify cost per user?")
  assert.equal(pricingIntent.primaryIntent, "pricing")
  assert.equal(pricingIntent.suggestDemo, true)

  const implementationIntent = detectDemoAssistantIntent("What does implementation look like?")
  assert.equal(implementationIntent.primaryIntent, "implementation")
  assert.equal(implementationIntent.suggestDemo, true)

  const featureIntent = detectDemoAssistantIntent("Can technicians update work orders from mobile?")
  assert.equal(featureIntent.primaryIntent, "feature")

  const demoIntent = detectDemoAssistantIntent("I'd like to book a demo this week")
  assert.equal(demoIntent.primaryIntent, "demo")
  assert.equal(demoIntent.suggestImmediateFollowUp, true)
  console.log("  ✓ Intent detection for pricing, implementation, feature, demo")

  const recommendations = generateGeV14DemoAssistantRecommendations([
    { eventType: "response_generated", eventValue: { intent: "integration" } },
    { eventType: "booking_offered" },
    { eventType: "conversation_completed" },
  ])
  assert.ok(recommendations.some((r) => r.id === "demo_assistant_quickbooks_demo"))
  assert.ok(recommendations.some((r) => r.id === "demo_assistant_immediate_follow_up"))
  console.log("  ✓ Demo assistant recommendations")

  const outcome = buildConversationOutcome({
    questions: ["Does Equipify integrate with QuickBooks?", "How much does it cost?"],
    intents: ["integration", "pricing"],
    bookingOffered: true,
    bookingStarted: true,
    bookingCompleted: false,
  })
  assert.match(outcome.summary, /2 question/)
  assert.equal(outcome.bookingOutcome, "started")
  assert.ok(!("transcript" in outcome))
  console.log("  ✓ Conversation outcome (summary only, no transcript archive)")

  const layout = fs.readFileSync(
    path.join(process.cwd(), "components/growth/sendr/presentation/sendr-public-presentation-layout.tsx"),
    "utf8",
  )
  assert.match(layout, /GrowthDemoAssistantWidget/)

  const widget = fs.readFileSync(
    path.join(process.cwd(), "components/growth/demo-assistant/growth-demo-assistant-widget.tsx"),
    "utf8",
  )
  assert.match(widget, /Ask Equipify AI/)
  assert.match(widget, /Book Demo/)
  assert.match(widget, /aria-label="Equipify demo assistant"/)
  console.log("  ✓ Public widget embedded in presentation layout")

  const readinessSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/demo-assistant/ge-v1-4-retell-provider-readiness.ts"),
    "utf8",
  )
  assert.match(readinessSource, /gracefulDegradation/)
  assert.match(readinessSource, /humanApprovalGatesEnabled/)
  assert.match(readinessSource, /autonomousSendingEnabled: false/)
  console.log("  ✓ Provider readiness report structure")

  console.log("\nGE-v1-4 local regression passed.\n")
}

async function runProductionProbe(): Promise<void> {
  bootstrapVerifiedChannelsCertEnv(PRODUCTION_ENV_SOURCES)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  assert.ok(url && key, "Production Supabase env required for --production probe")

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const report = await buildGeV14RetellProviderReadinessReport(admin)

  assert.equal(report.qaMarker, GE_V1_4_DEMO_ASSISTANT_QA_MARKER)
  assert.ok(report.knowledgeBundle.topicCount >= 10)
  assert.equal(report.diagnostics.humanApprovalGatesEnabled, true)
  assert.equal(report.diagnostics.autonomousSendingEnabled, false)

  console.log("\n=== GE-v1-4 Production Provider Readiness ===\n")
  console.log(JSON.stringify(report, null, 2))

  if (report.blockers.length > 0) {
    console.warn("\nBlockers before production certification:")
    for (const blocker of report.blockers) console.warn(`  - ${blocker}`)
  }
  if (report.warnings.length > 0) {
    console.warn("\nOperator warnings:")
    for (const warning of report.warnings) console.warn(`  - ${warning}`)
  }

  console.log("\nGE-v1-4 production probe complete.\n")
}

const production = process.argv.includes("--production")
if (production) {
  void runProductionProbe()
} else {
  runLocalRegression()
}
