import { NextResponse } from "next/server"
import { z } from "zod"
import {
  GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES,
  GROWTH_SENDR_LANDING_PAGE_STATUSES,
  GROWTH_SENDR_QA_MARKER,
  GROWTH_SENDR_WORKSPACE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { consumeSendrBudget } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { getGrowthSendrBookingAsset } from "@/lib/growth/sendr/growth-sendr-booking-runtime-repository"
import {
  archiveGrowthSendrLandingPage,
  createGrowthSendrLandingPage,
  deleteGrowthSendrLandingPageSection,
  getGrowthSendrLandingPage,
  listGrowthSendrLandingPagePublications,
  listGrowthSendrLandingPageSections,
  listGrowthSendrLandingPages,
  publishGrowthSendrLandingPage,
  updateGrowthSendrLandingPage,
  updateGrowthSendrLandingPageSection,
  upsertGrowthSendrLandingPageSection,
} from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"
import { getGrowthSendrVideoAsset } from "@/lib/growth/sendr/growth-sendr-video-runtime-repository"
import { buildSendrPagePublicLink } from "@/lib/growth/sendr/growth-sendr-slug-runtime"

export const runtime = "nodejs"

const BodySchema = z.object({
  action: z
    .enum([
      "create",
      "update",
      "add_section",
      "update_section",
      "remove_section",
      "publish",
      "archive",
    ])
    .optional(),
  title: z.string().min(1).max(200).optional(),
  leadId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional(),
  audienceMemberId: z.string().uuid().optional(),
  templateType: z.string().max(80).optional(),
  mediaAssetId: z.string().uuid().optional().nullable(),
  legacySharePageId: z.string().uuid().optional(),
  variableMap: z.record(z.string()).optional(),
  mobileMetadata: z.record(z.unknown()).optional(),
  landingPageId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  sectionType: z.enum(GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES).optional(),
  sortOrder: z.number().int().min(0).optional(),
  content: z.record(z.unknown()).optional(),
  status: z.enum(GROWTH_SENDR_LANDING_PAGE_STATUSES).optional(),
})

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    const action = parsed.data.action ?? "create"

    if (action === "create") {
      if (!parsed.data.title) {
        return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 })
      }
      const budget = await consumeSendrBudget(access.admin, {
        organizationId: access.organizationId,
        resourceType: "landing_pages",
      })
      if (!budget.allowed) {
        return NextResponse.json({ ok: false, message: budget.reason }, { status: 429 })
      }

      const mobileMetadata: Record<string, unknown> = {
        ...(parsed.data.mobileMetadata ?? {}),
        templateType: parsed.data.templateType ?? "default",
      }
      if (parsed.data.companyId) mobileMetadata.companyId = parsed.data.companyId
      if (parsed.data.audienceMemberId) mobileMetadata.audienceMemberId = parsed.data.audienceMemberId

      const page = await createGrowthSendrLandingPage(access.admin, {
        organizationId: access.organizationId,
        ownerUserId: access.userId,
        title: parsed.data.title,
        leadId: parsed.data.leadId,
        mediaAssetId: parsed.data.mediaAssetId,
        legacySharePageId: parsed.data.legacySharePageId,
        variableMap: parsed.data.variableMap,
        mobileMetadata,
      })
      return NextResponse.json({ ok: true, page, qa_marker: GROWTH_SENDR_QA_MARKER })
    }

    if (action === "update") {
      if (!parsed.data.landingPageId) {
        return NextResponse.json({ ok: false, error: "landing_page_id_required" }, { status: 400 })
      }
      const current = await getGrowthSendrLandingPage(access.admin, parsed.data.landingPageId)
      if (!current || current.organizationId !== access.organizationId) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
      }
      const page = await updateGrowthSendrLandingPage(access.admin, {
        landingPageId: parsed.data.landingPageId,
        organizationId: access.organizationId,
        title: parsed.data.title,
        status: parsed.data.status,
        variableMap: parsed.data.variableMap,
        leadId: parsed.data.leadId,
        mediaAssetId: parsed.data.mediaAssetId,
        mobileMetadata: parsed.data.mobileMetadata
          ? { ...current.mobileMetadata, ...parsed.data.mobileMetadata }
          : undefined,
      })
      return NextResponse.json({ ok: true, page, qa_marker: GROWTH_SENDR_QA_MARKER })
    }

    if (action === "add_section") {
      if (!parsed.data.landingPageId || !parsed.data.sectionType) {
        return NextResponse.json({ ok: false, error: "section_fields_required" }, { status: 400 })
      }
      const section = await upsertGrowthSendrLandingPageSection(access.admin, {
        landingPageId: parsed.data.landingPageId,
        organizationId: access.organizationId,
        sectionType: parsed.data.sectionType,
        sortOrder: parsed.data.sortOrder ?? 0,
        content: parsed.data.content ?? {},
      })
      return NextResponse.json({ ok: true, section, qa_marker: GROWTH_SENDR_QA_MARKER })
    }

    if (action === "update_section") {
      if (!parsed.data.landingPageId || !parsed.data.sectionId) {
        return NextResponse.json({ ok: false, error: "section_fields_required" }, { status: 400 })
      }
      const section = await updateGrowthSendrLandingPageSection(access.admin, {
        sectionId: parsed.data.sectionId,
        landingPageId: parsed.data.landingPageId,
        organizationId: access.organizationId,
        content: parsed.data.content,
        sortOrder: parsed.data.sortOrder,
      })
      return NextResponse.json({ ok: true, section, qa_marker: GROWTH_SENDR_QA_MARKER })
    }

    if (action === "remove_section") {
      if (!parsed.data.landingPageId || !parsed.data.sectionId) {
        return NextResponse.json({ ok: false, error: "section_fields_required" }, { status: 400 })
      }
      await deleteGrowthSendrLandingPageSection(access.admin, {
        sectionId: parsed.data.sectionId,
        landingPageId: parsed.data.landingPageId,
        organizationId: access.organizationId,
      })
      return NextResponse.json({ ok: true, qa_marker: GROWTH_SENDR_QA_MARKER })
    }

    if (action === "publish") {
      if (!parsed.data.landingPageId) {
        return NextResponse.json({ ok: false, error: "landing_page_id_required" }, { status: 400 })
      }
      const page = await publishGrowthSendrLandingPage(access.admin, {
        landingPageId: parsed.data.landingPageId,
        organizationId: access.organizationId,
        publishedBy: access.userId,
      })
      const publications = await listGrowthSendrLandingPagePublications(
        access.admin,
        parsed.data.landingPageId,
        1,
      )
      const publicLink = buildSendrPagePublicLink(page.publishedSlug ?? page.slug ?? page.id)
      return NextResponse.json({
        ok: true,
        page,
        publication: publications[0] ?? null,
        publicLink,
        qa_marker: GROWTH_SENDR_QA_MARKER,
      })
    }

    if (action === "archive") {
      if (!parsed.data.landingPageId) {
        return NextResponse.json({ ok: false, error: "landing_page_id_required" }, { status: 400 })
      }
      const page = await archiveGrowthSendrLandingPage(access.admin, {
        landingPageId: parsed.data.landingPageId,
        organizationId: access.organizationId,
      })
      return NextResponse.json({ ok: true, page, qa_marker: GROWTH_SENDR_QA_MARKER })
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "landing_page_failed"
    const status =
      message.includes("cap_exceeded") || message.includes("budget") ? 429 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const landingPageId = url.searchParams.get("landingPageId")
  const includeDetail = url.searchParams.get("include") === "detail"

  if (landingPageId) {
    const page = await getGrowthSendrLandingPage(access.admin, landingPageId)
    if (!page || page.organizationId !== access.organizationId) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    if (!includeDetail) {
      return NextResponse.json({ ok: true, page, qa_marker: GROWTH_SENDR_QA_MARKER })
    }

    const [sections, publications] = await Promise.all([
      listGrowthSendrLandingPageSections(access.admin, landingPageId),
      listGrowthSendrLandingPagePublications(access.admin, landingPageId),
    ])

    const videoAssetId =
      typeof page.mobileMetadata.videoAssetId === "string" ? page.mobileMetadata.videoAssetId : null
    const bookingAssetId =
      typeof page.mobileMetadata.bookingAssetId === "string"
        ? page.mobileMetadata.bookingAssetId
        : null

    const [videoAsset, bookingAsset] = await Promise.all([
      videoAssetId ? getGrowthSendrVideoAsset(access.admin, videoAssetId) : Promise.resolve(null),
      bookingAssetId ? getGrowthSendrBookingAsset(access.admin, bookingAssetId) : Promise.resolve(null),
    ])

    return NextResponse.json({
      ok: true,
      page,
      sections,
      publications,
      videoAsset,
      bookingAsset,
      publicLink: buildSendrPagePublicLink(page.publishedSlug ?? page.slug ?? page.id),
      qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER,
    })
  }

  const limit = Number(url.searchParams.get("limit") ?? 20)
  const offset = Number(url.searchParams.get("offset") ?? 0)
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && GROWTH_SENDR_LANDING_PAGE_STATUSES.includes(statusParam as never)
      ? (statusParam as (typeof GROWTH_SENDR_LANDING_PAGE_STATUSES)[number])
      : undefined

  const result = await listGrowthSendrLandingPages(access.admin, {
    organizationId: access.organizationId,
    limit,
    offset,
    status,
  })

  return NextResponse.json({
    ok: true,
    items: result.items,
    total: result.total,
    qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER,
  })
}
