/**
 * GE-v1-1 — seed medical ICP kit + Equipify Demo page (production-safe, idempotent).
 *
 * Run (production):
 *   CONFIRM_GE_V1_1_SEED=1 node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/seed-ge-v1-1-operational-baseline.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE,
  GE_V1_1_MEDICAL_AUDIENCE_NAME,
  GE_V1_1_MEDICAL_ICP_KIT_QA_MARKER,
  GE_V1_1_MEDICAL_SAVED_SEARCHES,
} from "../lib/growth/operational/ge-v1-1-medical-icp-kit"
import { getGrowthSendrPageTemplate } from "../lib/growth/sendr/growth-sendr-page-templates"

const DEFAULT_OPERATOR_ORG_ID = "5876176a-61ec-4532-ad99-0c31482d5a91"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function requireConfirm(): void {
  if (process.env.CONFIRM_GE_V1_1_SEED !== "1") {
    console.error("Refusing seed without CONFIRM_GE_V1_1_SEED=1")
    process.exit(1)
  }
}

function createProductionAdmin(): SupabaseClient {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) throw new Error("supabase_unavailable")
  if (boot.url) process.env.NEXT_PUBLIC_SUPABASE_URL = boot.url
  if (boot.jwt) process.env.SUPABASE_SERVICE_ROLE_KEY = boot.jwt
  return createClient(boot.url, boot.jwt, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function resolveOwnerUserId(admin: SupabaseClient, orgId: string): Promise<string> {
  const fromEnv = process.env.GE_V1_1_OWNER_USER_ID?.trim()
  if (fromEnv) return fromEnv

  const { data } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle()
  if (data?.user_id) return String(data.user_id)

  throw new Error("GE_V1_1_OWNER_USER_ID required — no org member found")
}

async function main() {
  requireConfirm()
  const admin = createProductionAdmin()
  const orgId = process.env.GE_V1_1_ORG_ID?.trim() || DEFAULT_OPERATOR_ORG_ID
  const ownerUserId = await resolveOwnerUserId(admin, orgId)

  const [
    { createGrowthAudience, listGrowthAudiences },
    { continueAudienceSnapshotGeneration, startAudienceSnapshotGeneration },
    { createProspectSearchSavedSearch, listProspectSearchSavedSearches },
    {
      createGrowthSendrLandingPage,
      getGrowthSendrLandingPage,
      publishGrowthSendrLandingPage,
      upsertGrowthSendrLandingPageSection,
    },
  ] = await Promise.all([
    import("../lib/growth/audiences/growth-audience-repository"),
    import("../lib/growth/audiences/growth-audience-snapshot-service"),
    import("../lib/growth/prospect-search/saved-searches"),
    import("../lib/growth/sendr/growth-sendr-landing-page-repository"),
  ])

  console.log(`GE-v1-1 seed org=${orgId} owner=${ownerUserId}`)

  const existingSearches = await listProspectSearchSavedSearches(admin)
  const byName = new Map(existingSearches.map((row) => [row.name, row]))
  for (const def of GE_V1_1_MEDICAL_SAVED_SEARCHES) {
    if (byName.has(def.name)) {
      console.log(`skip saved search (exists): ${def.name}`)
      continue
    }
    const row = await createProspectSearchSavedSearch(admin, {
      name: def.name,
      query_text: def.queryText,
      filters: def.filters,
      metadata: {
        ge_v1_1_kit: GE_V1_1_MEDICAL_ICP_KIT_QA_MARKER,
        kit_id: def.id,
        documentation: def.documentation,
      },
    })
    if (!row) throw new Error(`saved_search_create_failed:${def.id}`)
    console.log(`created saved search: ${def.name} (${row.id})`)
  }

  const { items } = await listGrowthAudiences(admin, { organizationId: orgId, limit: 100 })
  let audience = items.find((a) => a.name === GE_V1_1_MEDICAL_AUDIENCE_NAME) ?? null
  if (!audience) {
    const savedSearches = await listProspectSearchSavedSearches(admin)
    const primary =
      savedSearches.find((s) => s.name.includes("Biomedical equipment service")) ?? savedSearches[0]
    if (!primary) throw new Error("no_saved_search_for_audience")
    audience = await createGrowthAudience(admin, {
      organizationId: orgId,
      name: GE_V1_1_MEDICAL_AUDIENCE_NAME,
      description: "GE-v1-1 medical equipment ICP — union of medical equipment saved searches.",
      savedSearchId: primary.id,
      createdBy: ownerUserId,
      resultMode: "companies",
    })
    console.log(`created audience: ${audience.name} (${audience.id})`)
  } else {
    console.log(`skip audience (exists): ${audience.name} (${audience.id})`)
  }

  let progress = await startAudienceSnapshotGeneration(admin, {
    audienceId: audience.id,
    organizationId: orgId,
    userId: ownerUserId,
    isRefresh: true,
  })
  let guard = 0
  while (progress.hasMore && guard < 40) {
    progress = await continueAudienceSnapshotGeneration(admin, {
      audienceId: audience.id,
      organizationId: orgId,
      userId: ownerUserId,
      refreshRunId: progress.refreshRunId,
    })
    guard += 1
  }
  console.log(
    `audience snapshot: status=${progress.status} members=${progress.memberCount ?? "?"} snapshot=${progress.snapshotId ?? "—"}`,
  )

  const template = getGrowthSendrPageTemplate("equipify_demo")
  if (!template) throw new Error("equipify_demo_template_missing")

  const { data: existingPages } = await admin
    .schema("growth")
    .from("growth_landing_pages")
    .select("id, title, status, published_slug")
    .eq("organization_id", orgId)
    .eq("title", GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE)
    .is("deleted_at", null)
    .limit(1)

  let pageId = existingPages?.[0]?.id ? String(existingPages[0].id) : null
  if (!pageId) {
    const page = await createGrowthSendrLandingPage(admin, {
      organizationId: orgId,
      ownerUserId,
      title: GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE,
      variableMap: {
        meeting_link: "https://app.equipify.ai/book/equipify-demo",
      },
      mobileMetadata: { ge_v1_1_kit: GE_V1_1_MEDICAL_ICP_KIT_QA_MARKER },
    })
    pageId = page.id
    for (let i = 0; i < template.sections.length; i += 1) {
      const section = template.sections[i]!
      await upsertGrowthSendrLandingPageSection(admin, {
        landingPageId: page.id,
        organizationId: orgId,
        sectionType: section.sectionType,
        sortOrder: i,
        content: section.content,
      })
    }
    console.log(`created page: ${GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE} (${pageId})`)
  } else {
    console.log(`skip page (exists): ${GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE} (${pageId})`)
  }

  const page = await getGrowthSendrLandingPage(admin, pageId)
  if (!page) throw new Error("equipify_demo_page_not_found")
  if (page.status !== "published") {
    const published = await publishGrowthSendrLandingPage(admin, {
      landingPageId: page.id,
      organizationId: orgId,
      publishedBy: ownerUserId,
    })
    console.log(`published page slug=${published.publishedSlug ?? published.slug}`)
  } else {
    console.log(`page already published slug=${page.publishedSlug ?? page.slug}`)
  }

  console.log("\nGE-v1-1 operational baseline seed complete.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
