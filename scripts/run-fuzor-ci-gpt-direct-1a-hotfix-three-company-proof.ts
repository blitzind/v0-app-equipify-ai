/**
 * FUZOR-CI-GPT-DIRECT-1A-HOTFIX — Minimum three-company GPT-direct proof.
 * Run: pnpm run:fuzor-ci-gpt-direct-1a-hotfix-three-company-proof
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { fetchPublicHtmlDocument } from "../lib/growth/research-website-fetch"
import { stripHtmlToPlainText } from "../lib/growth/research-website-html"
import { normalizeLeadWebsite } from "../lib/growth/research-website-url"
import {
  runGptDirectCompanyIntelligenceExperiment,
  type GptDirectWebsiteRetrieval,
} from "../lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-experiment"
import {
  FUZOR_CI_GPT_DIRECT_HOTFIX_1A_OBJECTIVE,
  FUZOR_CI_GPT_DIRECT_1A_QA_MARKER,
} from "../lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-prompts"
import { fetchGrowthLeadById } from "../lib/growth/lead-repository"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const COHORT = [
  { leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725", label: "Best Buy" },
  { leadId: "b06417cf-8c67-4705-82f3-0b62e3d08ca2", label: "NAES" },
  { leadId: "03f6dd92-1057-4b16-ae17-c18a16d8fc89", label: "Solar Turbines" },
] as const

const HOTFIX_QA_MARKER = "fuzor-ci-gpt-direct-1a-hotfix-v1" as const

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

async function retrieveHomepageOnly(
  websiteUrl: string | null | undefined,
): Promise<GptDirectWebsiteRetrieval> {
  if (!websiteUrl?.trim()) {
    return {
      status: "no_website",
      normalizedUrl: null,
      pages: [],
      totalChars: 0,
      message: "No website URL supplied.",
    }
  }

  const normalized = normalizeLeadWebsite(websiteUrl)
  if (normalized.status !== "ready" || !normalized.url) {
    return {
      status: normalized.status === "invalid_url" ? "invalid_url" : "fetch_failed",
      normalizedUrl: null,
      pages: [],
      totalChars: 0,
      message: `Website URL not crawl-ready: ${normalized.status}`,
    }
  }

  let htmlBody: string | null = null
  let fetchMessage: string | null = null

  const fetched = await fetchPublicHtmlDocument(normalized.url)
  if (fetched.status === "ok" && fetched.body?.trim()) {
    htmlBody = fetched.body
  } else if (fetched.status === "skipped") {
    return {
      status: "disabled",
      normalizedUrl: normalized.url,
      pages: [],
      totalChars: 0,
      message: "Website retrieval disabled by configuration.",
    }
  } else {
    fetchMessage = fetched.status
    try {
      const response = await fetch(normalized.url, {
        headers: {
          Accept: "text/html",
          "User-Agent": "EquipifyGrowthResearch/1.0 (gpt-direct-hotfix)",
        },
        signal: AbortSignal.timeout(12_000),
      })
      if (response.ok) {
        htmlBody = (await response.text()).slice(0, 900_000)
      }
    } catch {
      // handled below
    }
  }

  if (!htmlBody?.trim()) {
    return {
      status: "fetch_failed",
      normalizedUrl: normalized.url,
      pages: [],
      totalChars: 0,
      message: `Homepage fetch failed: ${fetchMessage ?? fetched.status}`,
    }
  }

  const text = stripHtmlToPlainText(htmlBody).trim()
  if (!text) {
    return {
      status: "empty",
      normalizedUrl: normalized.url,
      pages: [],
      totalChars: 0,
      message: "Homepage retrieved but contained no usable text.",
    }
  }

  const clipped = text.length > 48_000 ? `${text.slice(0, 48_000 - 1)}…` : text
  return {
    status: "ok",
    normalizedUrl: normalized.url,
    pages: [{ url: normalized.url, text: clipped }],
    totalChars: clipped.length,
    message: null,
  }
}

function inferAvaLikelyDecision(input: {
  executiveSummary: string
  operationalSummary: string
  offerings: string[]
  evidenceWeakness: string | null
}): {
  avaCanDecide: boolean
  likelyDecision: "pursue" | "hold" | "reject" | "cannot_decide"
  reason: string
} {
  const blob = [input.executiveSummary, input.operationalSummary, ...input.offerings]
    .join(" ")
    .toLowerCase()

  if (
    input.evidenceWeakness &&
    (input.evidenceWeakness.toLowerCase().includes("cannot be determined") ||
      input.evidenceWeakness.toLowerCase().includes("insufficient"))
  ) {
    return {
      avaCanDecide: false,
      likelyDecision: "cannot_decide",
      reason: input.evidenceWeakness,
    }
  }

  const fieldServiceSignals = [
    "field service",
    "technician",
    "maintenance",
    "repair",
    "dispatch",
    "inspection",
    "equipment service",
    "service contract",
    "preventive maintenance",
  ]
  const nonFitSignals = [
    "consumer electronics",
    "retail",
    "e-commerce",
    "online store",
    "big-box",
    "shop online",
    "power generation equipment manufacturer",
    "manufactures gas turbines",
    "turbine manufacturer",
  ]

  const hasFieldService = fieldServiceSignals.some((s) => blob.includes(s))
  const hasNonFit = nonFitSignals.some((s) => blob.includes(s))

  if (hasNonFit && !hasFieldService) {
    return {
      avaCanDecide: true,
      likelyDecision: "reject",
      reason:
        "Website describes a retail or manufacturing business without a clear equipment-service / field-operations model relevant to Equipify.",
    }
  }

  if (hasFieldService) {
    return {
      avaCanDecide: true,
      likelyDecision: "pursue",
      reason:
        "Website describes equipment service, maintenance, or field operations sufficient to justify outreach.",
    }
  }

  if (blob.length > 200 && !input.evidenceWeakness) {
    return {
      avaCanDecide: true,
      likelyDecision: "hold",
      reason:
        "Business is understandable from the website, but Equipify fit is not clearly established from public positioning alone.",
    }
  }

  return {
    avaCanDecide: false,
    likelyDecision: "cannot_decide",
    reason: "Website understanding remains too thin for an honest pursue/reject judgment.",
  }
}

async function main(): Promise<void> {
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

  console.log(`[${HOTFIX_QA_MARKER}] minimum three-company GPT-direct proof`)
  console.log(JSON.stringify({ marker: FUZOR_CI_GPT_DIRECT_1A_QA_MARKER, cohortSize: COHORT.length }, null, 2))

  let understoodCount = 0

  for (const item of COHORT) {
    console.log(`\n============================================================`)
    console.log(item.label)

    const lead = await fetchGrowthLeadById(admin, item.leadId)
    if (!lead) {
      console.log(JSON.stringify({ ok: false, message: "Lead not found" }, null, 2))
      continue
    }

    const retrieval = await retrieveHomepageOnly(lead.website)
    console.log(
      JSON.stringify(
        {
          retrievalStatus: retrieval.status,
          normalizedUrl: retrieval.normalizedUrl,
          homepageTextChars: retrieval.totalChars,
          homepageTextPreview: retrieval.pages[0]?.text.slice(0, 240) ?? null,
        },
        null,
        2,
      ),
    )

    if (retrieval.status !== "ok") {
      console.log(
        JSON.stringify(
          {
            ok: false,
            technicalLimitation: retrieval.message ?? retrieval.status,
            avaCanDecide: false,
            avaLikelyDecision: "cannot_decide",
          },
          null,
          2,
        ),
      )
      continue
    }

    const run = await runGptDirectCompanyIntelligenceExperiment({
      companyName: lead.companyName,
      website: lead.website,
      organizationId,
      actingUserEmail: "gpt-direct-hotfix@equipify.internal",
      objective: FUZOR_CI_GPT_DIRECT_HOTFIX_1A_OBJECTIVE,
      retrieveWebsite: async () => retrieval,
    })

    if (!run.ok) {
      console.log(JSON.stringify({ ok: false, code: run.code, message: run.message }, null, 2))
      continue
    }

    const u = run.output.understanding
    const ava = inferAvaLikelyDecision({
      executiveSummary: u.executiveSummary,
      operationalSummary: u.operationalModel.summary,
      offerings: u.productsAndServices.offerings,
      evidenceWeakness: u.evidenceWeakness,
    })

    if (ava.avaCanDecide) understoodCount += 1

    console.log(
      JSON.stringify(
        {
          ok: true,
          companyName: lead.companyName,
          website: lead.website,
          whatCompanyDoes: u.executiveSummary,
          productsOrServices: u.productsAndServices.offerings,
          apparentCustomers: u.customers.segments.length
            ? u.customers.segments
            : u.customers.summary,
          apparentOperationalModel: u.operationalModel.summary,
          avaCanDecide: ava.avaCanDecide,
          avaLikelyDecision: ava.likelyDecision,
          avaLikelyReason: ava.reason,
          runtimeMs: run.output.durationMs,
        },
        null,
        2,
      ),
    )
  }

  const certification =
    understoodCount >= 2 ? "GPT-DIRECT DIRECTION CONFIRMED" : "CAPABILITY FAILURE — INVESTIGATE RETRIEVAL"

  console.log(`\n[${HOTFIX_QA_MARKER}] complete`)
  console.log(JSON.stringify({ understoodCount, certification }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
