/**
 * FUZOR-CI-GPT-DIRECT-1A-HOTFIX-2 — Single-company decisive Best Buy proof.
 * Run: pnpm run:fuzor-ci-gpt-direct-1a-hotfix-2-best-buy-proof
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { loadOutreachSellerTruthBundle } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { projectEquipifyKnowledgeBase } from "@/lib/growth/ava-reasoning/equipify-ava-reasoning-adapter"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { FUZOR_COMPANY_INTELLIGENCE_MODEL } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"

const HOTFIX_2_QA_MARKER = "fuzor-ci-gpt-direct-1a-hotfix-2-v1" as const
const BEST_BUY_LEAD_ID = "03a361d3-e6b6-42e6-bc78-a5773acc1725"
const BEST_BUY_WEBSITE = "https://bestbuy.com/"
const FIXTURE_PATH = "scripts/fixtures/fuzor-ci-gpt-direct-hotfix-2-best-buy-homepage.txt"
const GPT_TIMEOUT_MS = 120_000

const SALES_OBJECTIVE =
  "Based on this company's public website, determine what the company does and whether it is likely worth contacting about Equipify. This is an initial sales judgment, not due diligence. Make the best practical decision supported by the website."

const proofResultSchema = z.object({
  companyUnderstanding: z.string().min(1).max(4000),
  decision: z.enum(["pursue", "hold", "reject"]),
  rationale: z.string().min(1).max(2000),
  email: z
    .object({
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(4000),
    })
    .nullable(),
})

const PROOF_JSON_CONTRACT = [
  "REQUIRED JSON SHAPE:",
  JSON.stringify(
    {
      companyUnderstanding: "string — what the company does and how it operates",
      decision: "pursue | reject | hold",
      rationale: "string — practical sales judgment from website evidence",
      email: "null unless decision is pursue and a contactable recipient was supplied",
    },
    null,
    2,
  ),
  "Use only supplied website text and Equipify knowledge. Do not invent facts.",
  "When decision is reject or hold, email must be null.",
].join("\n")

function bootstrapOpenAiKeyFromLegacyHideFiles(cwd = process.cwd()): void {
  if (process.env.OPENAI_API_KEY?.trim()) return
  for (const relative of [
    ".env.local.rebuild.equipify-build-hidden",
    ".env.local.active.equipify-vercel-run-hidden",
  ]) {
    const absolute = resolve(cwd, relative)
    if (!existsSync(absolute)) continue
    for (const line of readFileSync(absolute, "utf8").split("\n")) {
      if (!line.startsWith("OPENAI_API_KEY=")) continue
      let value = line.slice("OPENAI_API_KEY=".length).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value.length < 20) continue
      process.env.OPENAI_API_KEY = value
      if (!process.env.AI_ENABLED_PROVIDERS?.trim()) process.env.AI_ENABLED_PROVIDERS = "openai"
      return
    }
  }
}

function loadCachedBestBuyWebsiteText(): { text: string; chars: number } {
  const absolute = resolve(process.cwd(), FIXTURE_PATH)
  if (!existsSync(absolute)) {
    throw new Error(
      `Missing cached Best Buy homepage fixture at ${FIXTURE_PATH}. Prior retrieval must be cached first.`,
    )
  }
  const text = readFileSync(absolute, "utf8").trim()
  return { text, chars: text.length }
}

function buildSystemPrompt(): string {
  return [
    "You are an experienced salesperson evaluating whether a company is worth contacting about Equipify.",
    "Equipify serves equipment-service and field-operation companies.",
    "Use only the supplied website text and Equipify knowledge.",
    "Do not invent facts. Make a practical sales judgment, not due diligence.",
    "Return JSON only.",
  ].join("\n")
}

function buildUserPrompt(input: {
  companyName: string
  website: string
  websiteText: string
  equipifyKnowledge: ReturnType<typeof projectEquipifyKnowledgeBase>
  contactName: string | null
  contactEmail: string | null
}): string {
  return [
    SALES_OBJECTIVE,
    "",
    "COMPANY NAME",
    input.companyName,
    "",
    "WEBSITE",
    input.website,
    "",
    "RETRIEVED WEBSITE TEXT (substantially unaltered)",
    input.websiteText,
    "",
    "EQUIPIFY DEPLOYMENT KNOWLEDGE",
    JSON.stringify(
      {
        organizationName: input.equipifyKnowledge.organizationName,
        identitySummary: input.equipifyKnowledge.identitySummary,
        productsAndCapabilities: input.equipifyKnowledge.productsAndCapabilities,
        customersServed: input.equipifyKnowledge.customersServed,
        problemsSolved: input.equipifyKnowledge.problemsSolved,
        disqualifiers: input.equipifyKnowledge.disqualifiers,
      },
      null,
      2,
    ),
    "",
    "SUPPLIED CONTACT (optional — email only if pursue and contact is usable)",
    JSON.stringify(
      {
        name: input.contactName,
        email: input.contactEmail,
      },
      null,
      2,
    ),
    "",
    PROOF_JSON_CONTRACT,
  ].join("\n")
}

async function runSingleGptRequest(input: {
  organizationId: string
  systemPrompt: string
  userPrompt: string
  actingUserEmail: string
}): Promise<
  | { ok: true; output: z.infer<typeof proofResultSchema>; durationMs: number }
  | { ok: false; code: "timeout" | "model_failed"; message: string; durationMs: number }
> {
  const started = Date.now()

  const aiPromise = runAiTask({
    task: "growth_copilot_generation",
    organizationId: input.organizationId,
    actingUserEmail: input.actingUserEmail,
    input: {
      system: input.systemPrompt,
      user: input.userPrompt,
    },
    schema: proofResultSchema,
    cacheSchemaVersion: `${HOTFIX_2_QA_MARKER}_single`,
    skipPlanGateCheck: true,
    skipBudgetCheck: true,
    skipCache: true,
    skipExecutionModeMock: true,
    forceLiveAi: true,
    taskOverrides: {
      structuredMode: "json_object",
      primaryModel: { provider: "openai", model: FUZOR_COMPANY_INTELLIGENCE_MODEL },
      fallbackModel: { provider: "openai", model: FUZOR_COMPANY_INTELLIGENCE_MODEL },
      escalationModel: { provider: "openai", model: FUZOR_COMPANY_INTELLIGENCE_MODEL },
      maxOutputTokens: 4096,
      timeoutMs: GPT_TIMEOUT_MS,
      maxRetries: 0,
    },
  })

  let timeoutHandle: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<{ ok: false; code: "timeout"; message: string }>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({
        ok: false,
        code: "timeout",
        message: `GPT request exceeded hard timeout of ${GPT_TIMEOUT_MS}ms`,
      })
    }, GPT_TIMEOUT_MS)
  })

  const result = await Promise.race([aiPromise, timeoutPromise])
  if (timeoutHandle) clearTimeout(timeoutHandle)
  const durationMs = Date.now() - started

  if ("code" in result && result.code === "timeout") {
    return { ok: false, code: "timeout", message: result.message, durationMs }
  }

  const ai = result as Awaited<typeof aiPromise>
  if (!ai.ok) {
    return {
      ok: false,
      code: "model_failed",
      message: ai.error?.message ?? "Model call failed.",
      durationMs,
    }
  }

  const parsed = proofResultSchema.safeParse(ai.output)
  if (!parsed.success) {
    return {
      ok: false,
      code: "model_failed",
      message: "Structured output failed schema validation.",
      durationMs,
    }
  }

  const normalized = {
    ...parsed.data,
    companyUnderstanding: parsed.data.companyUnderstanding.trim(),
    rationale: parsed.data.rationale.trim(),
    email:
      parsed.data.decision === "pursue" &&
      parsed.data.email?.subject?.trim() &&
      parsed.data.email?.body?.trim()
        ? {
            subject: parsed.data.email.subject.trim(),
            body: parsed.data.email.body.trim(),
          }
        : null,
  }

  return { ok: true, output: normalized, durationMs }
}

async function main(): Promise<void> {
  const totalStarted = Date.now()
  bootstrapVerifiedChannelsCertEnv()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY unavailable.")

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("GROWTH_ENGINE_AI_ORG_ID unavailable.")

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) throw new Error("Supabase credentials unavailable.")
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log(`[${HOTFIX_2_QA_MARKER}] single-company decisive proof — Best Buy only`)

  const prepStarted = Date.now()
  const website = loadCachedBestBuyWebsiteText()
  const lead = await fetchGrowthLeadById(admin, BEST_BUY_LEAD_ID)
  if (!lead) throw new Error("Best Buy lead not found.")

  const sellerBundle = await loadOutreachSellerTruthBundle(admin, {
    organizationId,
    preparedAt: new Date().toISOString(),
    prospectCompanyName: lead.companyName,
    leadId: lead.id,
  })
  const equipifyKnowledge = projectEquipifyKnowledgeBase(sellerBundle.sellerTruth)
  const websiteContentPrepMs = Date.now() - prepStarted

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt({
    companyName: lead.companyName,
    website: BEST_BUY_WEBSITE,
    websiteText: website.text,
    equipifyKnowledge,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
  })

  const gptStarted = Date.now()
  const gpt = await runSingleGptRequest({
    organizationId,
    systemPrompt,
    userPrompt,
    actingUserEmail: "gpt-direct-hotfix-2@equipify.internal",
  })
  const gptRequestMs = Date.now() - gptStarted
  const totalMs = Date.now() - totalStarted

  const timing = {
    websiteContentPrepMs,
    gptRequestMs,
    totalMs,
  }

  if (!gpt.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          companyName: lead.companyName,
          website: BEST_BUY_WEBSITE,
          websiteTextChars: website.chars,
          code: gpt.code,
          message: gpt.message,
          timing,
          certification: null,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const retailSignals = [
    "consumer electronics",
    "retail",
    "online store",
    "shop",
    "deals",
    "omnichannel",
  ]
  const blob = `${gpt.output.companyUnderstanding} ${gpt.output.rationale}`.toLowerCase()
  const identifiesRetail = retailSignals.some((signal) => blob.includes(signal))
  const practicalReject = gpt.output.decision === "reject" && identifiesRetail

  const certification = identifiesRetail && (practicalReject || gpt.output.decision === "hold")
    ? "GPT-DIRECT DIRECTION CONFIRMED"
    : gpt.output.decision === "pursue"
      ? "GPT-DIRECT DIRECTION CONFIRMED (unexpected pursue — review rationale)"
      : "INCONCLUSIVE — review output"

  console.log(
    JSON.stringify(
      {
        ok: true,
        companyName: lead.companyName,
        website: BEST_BUY_WEBSITE,
        websiteTextChars: website.chars,
        companyUnderstanding: gpt.output.companyUnderstanding,
        decision: gpt.output.decision,
        rationale: gpt.output.rationale,
        email: gpt.output.email,
        identifiesConsumerRetail: identifiesRetail,
        timing,
        certification,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
