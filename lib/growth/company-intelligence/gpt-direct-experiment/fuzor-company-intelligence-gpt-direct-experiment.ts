/**
 * FUZOR-COMPANY-INTELLIGENCE-GPT-DIRECT-1A — Parallel experimental path.
 *
 * Website → GPT → Company Intelligence
 * Does NOT modify production CI. Does NOT use evidence extraction pipeline.
 */

import "server-only"

import { runAiTask } from "@/lib/ai/server"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchPublicHtmlDocument } from "@/lib/growth/research-website-fetch"
import { stripHtmlToPlainText } from "@/lib/growth/research-website-html"
import { normalizeLeadWebsite } from "@/lib/growth/research-website-url"
import {
  FUZOR_COMPANY_INTELLIGENCE_JSON_CONTRACT,
  fuzorCompanyBusinessUnderstandingSchema,
  normalizeFuzorCompanyBusinessUnderstanding,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-schema"
import {
  FUZOR_COMPANY_INTELLIGENCE_MODEL,
  type FuzorCompanyBusinessUnderstanding,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import {
  buildGptDirectCompanyIntelligenceSystemPrompt,
  buildGptDirectCompanyIntelligenceUserPrompt,
  FUZOR_CI_GPT_DIRECT_1A_QA_MARKER,
  FUZOR_CI_GPT_DIRECT_PROMPT_VERSION,
} from "@/lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-prompts"
import { coerceGptDirectCompanyUnderstanding } from "@/lib/growth/company-intelligence/gpt-direct-experiment/fuzor-company-intelligence-gpt-direct-coerce"

const MAX_PAGE_TEXT_CHARS = 12_000
const MAX_TOTAL_TEXT_CHARS = 48_000
const MAX_ADDITIONAL_PAGES = 4

export type GptDirectWebsitePage = {
  url: string
  text: string
}

export type GptDirectWebsiteRetrieval = {
  status: "ok" | "no_website" | "fetch_failed" | "empty" | "disabled" | "invalid_url"
  normalizedUrl: string | null
  pages: GptDirectWebsitePage[]
  totalChars: number
  message: string | null
}

export type GptDirectCompanyIntelligenceOutput = {
  qaMarker: typeof FUZOR_CI_GPT_DIRECT_1A_QA_MARKER
  promptVersion: typeof FUZOR_CI_GPT_DIRECT_PROMPT_VERSION
  companyName: string
  website: string | null
  websiteRetrieval: GptDirectWebsiteRetrieval
  understanding: FuzorCompanyBusinessUnderstanding
  provider: string | null
  model: string | null
  durationMs: number
  promptTokens: number | null
  completionTokens: number | null
}

function trimPageText(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ")
  if (normalized.length <= MAX_PAGE_TEXT_CHARS) return normalized
  return `${normalized.slice(0, MAX_PAGE_TEXT_CHARS - 1)}…`
}

function extractSameOriginLinks(html: string, origin: string): string[] {
  const links: string[] = []
  const seen = new Set<string>()
  const pattern = /\bhref=["']([^"'#]+)["']/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1]?.trim()
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue
    }
    try {
      const absolute = new URL(href, origin).href
      if (!absolute.startsWith(origin)) continue
      const key = absolute.split("#")[0]!
      if (seen.has(key)) continue
      seen.add(key)
      links.push(key)
      if (links.length >= MAX_ADDITIONAL_PAGES * 3) break
    } catch {
      continue
    }
  }
  return links.filter((url) => {
    const normalizedPage = url.replace(/\/$/, "")
    const normalizedOrigin = origin.replace(/\/$/, "")
    return normalizedPage !== normalizedOrigin
  })
}

export async function retrieveWebsiteTextForGptDirect(
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

  const homepage = await fetchPublicHtmlDocument(normalized.url)
  if (homepage.status === "skipped") {
    return {
      status: "disabled",
      normalizedUrl: normalized.url,
      pages: [],
      totalChars: 0,
      message: "Website retrieval disabled by configuration.",
    }
  }
  if (homepage.status !== "ok" || !homepage.body?.trim()) {
    return {
      status: "fetch_failed",
      normalizedUrl: normalized.url,
      pages: [],
      totalChars: 0,
      message: `Homepage fetch failed: ${homepage.status}`,
    }
  }

  const pages: GptDirectWebsitePage[] = []
  let totalChars = 0

  const pushPage = (url: string, html: string) => {
    const text = trimPageText(stripHtmlToPlainText(html))
    if (!text) return
    const remaining = MAX_TOTAL_TEXT_CHARS - totalChars
    if (remaining <= 0) return
    const clipped = text.length > remaining ? `${text.slice(0, remaining - 1)}…` : text
    pages.push({ url, text: clipped })
    totalChars += clipped.length
  }

  pushPage(normalized.url, homepage.body)
  if (pages.length === 0) {
    return {
      status: "empty",
      normalizedUrl: normalized.url,
      pages: [],
      totalChars: 0,
      message: "Homepage retrieved but contained no usable text.",
    }
  }

  const origin = new URL(normalized.url).origin
  const candidateLinks = extractSameOriginLinks(homepage.body, origin)
  for (const link of candidateLinks) {
    if (pages.length >= MAX_ADDITIONAL_PAGES + 1) break
    if (totalChars >= MAX_TOTAL_TEXT_CHARS) break
    if (pages.some((page) => page.url === link)) continue
    const fetched = await fetchPublicHtmlDocument(link)
    if (fetched.status !== "ok" || !fetched.body?.trim()) continue
    pushPage(link, fetched.body)
  }

  return {
    status: "ok",
    normalizedUrl: normalized.url,
    pages,
    totalChars,
    message: null,
  }
}

export type RunGptDirectCompanyIntelligenceExperimentInput = {
  companyName: string
  website: string | null
  organizationId: string
  actingUserEmail?: string | null
  objective?: string
  retrieveWebsite?: (website: string | null | undefined) => Promise<GptDirectWebsiteRetrieval>
  runModel?: (input: {
    organizationId: string
    systemPrompt: string
    userPrompt: string
  }) => Promise<{
    understanding: FuzorCompanyBusinessUnderstanding
    provider: string | null
    model: string | null
    promptTokens?: number | null
    completionTokens?: number | null
  }>
}

export type RunGptDirectCompanyIntelligenceExperimentResult =
  | { ok: true; output: GptDirectCompanyIntelligenceOutput }
  | { ok: false; code: "website_unavailable" | "model_failed"; message: string }

export async function runGptDirectCompanyIntelligenceExperiment(
  input: RunGptDirectCompanyIntelligenceExperimentInput,
): Promise<RunGptDirectCompanyIntelligenceExperimentResult> {
  const started = Date.now()
  const retrieve = input.retrieveWebsite ?? retrieveWebsiteTextForGptDirect
  const retrieval = await retrieve(input.website)

  if (retrieval.status !== "ok" || retrieval.pages.length === 0) {
    return {
      ok: false,
      code: "website_unavailable",
      message: retrieval.message ?? `Website retrieval status: ${retrieval.status}`,
    }
  }

  const systemPrompt = buildGptDirectCompanyIntelligenceSystemPrompt()
  const userPrompt = `${buildGptDirectCompanyIntelligenceUserPrompt({
    companyName: input.companyName,
    website: input.website,
    websitePages: retrieval.pages,
    retrievalStatus: retrieval.status,
    objective: input.objective,
  })}\n\n${FUZOR_COMPANY_INTELLIGENCE_JSON_CONTRACT}`

  const runModel =
    input.runModel ??
    (async (args: {
      organizationId: string
      systemPrompt: string
      userPrompt: string
    }) => {
      let lastError: string | null = null
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const ai = await runAiTask({
          task: "growth_copilot_generation",
          organizationId: args.organizationId,
          actingUserEmail: input.actingUserEmail ?? null,
          input: { system: args.systemPrompt, user: args.userPrompt },
          schema: fuzorCompanyBusinessUnderstandingSchema,
          cacheSchemaVersion: `${FUZOR_CI_GPT_DIRECT_PROMPT_VERSION}_attempt_${attempt}`,
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
            maxOutputTokens: 8192,
            timeoutMs: 180_000,
            maxRetries: 1,
          },
        })

        if (!ai.ok) {
          lastError = ai.error?.message ?? "Model call failed."
          continue
        }

        const parsed = fuzorCompanyBusinessUnderstandingSchema.safeParse(ai.output)
        if (!parsed.success) {
          const coerced = coerceGptDirectCompanyUnderstanding(ai.output)
          if (!coerced) {
            lastError = "Structured output failed schema validation."
            continue
          }
          return {
            understanding: coerced,
            provider: ai.meta.provider ?? null,
            model: ai.meta.model ?? null,
            promptTokens: ai.usage?.promptTokens ?? null,
            completionTokens: ai.usage?.completionTokens ?? null,
          }
        }

        return {
          understanding: normalizeFuzorCompanyBusinessUnderstanding(parsed.data),
          provider: ai.meta.provider ?? null,
          model: ai.meta.model ?? null,
          promptTokens: ai.usage?.promptTokens ?? null,
          completionTokens: ai.usage?.completionTokens ?? null,
        }
      }

      throw new Error(lastError ?? "Model call failed.")
    })

  try {
    const modelOut = await runModel({
      organizationId: input.organizationId,
      systemPrompt,
      userPrompt,
    })

    const output: GptDirectCompanyIntelligenceOutput = {
      qaMarker: FUZOR_CI_GPT_DIRECT_1A_QA_MARKER,
      promptVersion: FUZOR_CI_GPT_DIRECT_PROMPT_VERSION,
      companyName: input.companyName,
      website: input.website,
      websiteRetrieval: retrieval,
      understanding: modelOut.understanding,
      provider: modelOut.provider,
      model: modelOut.model,
      durationMs: Date.now() - started,
      promptTokens: modelOut.promptTokens ?? null,
      completionTokens: modelOut.completionTokens ?? null,
    }

    logGrowthEngine("fuzor_company_intelligence_gpt_direct_experiment_completed", {
      companyName: input.companyName,
      website: input.website,
      pageCount: retrieval.pages.length,
      totalChars: retrieval.totalChars,
      evidenceWeakness: output.understanding.evidenceWeakness,
    })

    return { ok: true, output }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model call failed."
    return { ok: false, code: "model_failed", message }
  }
}

/** Map GPT-direct understanding into Ava-consumable CI view (experiment only). */
export function toExperimentCompanyIntelligenceForAiEmployee(input: {
  ownerOrganizationId: string
  leadId: string
  companyName: string
  website: string | null
  understanding: FuzorCompanyBusinessUnderstanding
  websiteRetrieval: GptDirectWebsiteRetrieval
}): import("@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types").CompanyIntelligenceForAiEmployee {
  return {
    ownerOrganizationId: input.ownerOrganizationId,
    aiDeploymentId: "gpt-direct-experiment-1a",
    companyId: null,
    externalCompanyId: null,
    leadId: input.leadId,
    companyName: input.companyName,
    website: input.website,
    companyIntelligenceVersionId: `gpt-direct-experiment:${input.leadId}`,
    companyIntelligenceVersion: FUZOR_CI_GPT_DIRECT_PROMPT_VERSION,
    evidenceFingerprint: `gpt-direct-${input.websiteRetrieval.totalChars}`,
    createdAt: new Date().toISOString(),
    understanding: input.understanding,
    evidenceRefs: {
      leadId: input.leadId,
      website: input.website,
      linkedinCompanyUrl: null,
      hasVerifiedDescription: Boolean(input.understanding.executiveSummary.trim()),
      verifiedOfferingCount: input.understanding.productsAndServices.offerings.length,
      verifiedIndustryCount: input.understanding.industriesServed.industries.length,
      websiteExcerptCount: input.websiteRetrieval.pages.length,
      pagesObserved: input.websiteRetrieval.pages.map((page) => ({
        url: page.url,
        pageType: "retrieved",
        status: "crawled",
      })),
      datamoonFindingCount: 0,
      missingFromCollection: [],
      priorResearchNotesPresent: false,
    },
  }
}
