/** GS-SENDR-4B — Operator return flow between Personalized Videos and Growth Video. */

import {
  buildGrowthPersonalizedVideosPageDetailPath,
  GROWTH_PERSONALIZED_VIDEOS_LEGACY_WORKSPACE_PREFIX,
  GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH,
} from "@/lib/growth/sendr/growth-sendr-branding"

export const SENDR_VIDEO_RETURN_QUERY = {
  returnTo: "returnTo",
  landingPageId: "landingPageId",
  sectionId: "sectionId",
  assetId: "assetId",
  attachPending: "attachPending",
  upload: "upload",
} as const

export type SendrVideoReturnContext = {
  returnTo: string
  landingPageId: string
  sectionId?: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSendrUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value))
}

export function isSafeSendrReturnPath(path: string): boolean {
  const allowedPrefixes = [
    `${GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH}/`,
    `${GROWTH_PERSONALIZED_VIDEOS_LEGACY_WORKSPACE_PREFIX}/`,
  ]
  if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) return false
  if (path.includes("//") || path.includes("..")) return false
  if (path.includes("?")) return false
  return true
}

export function buildSendrPageDetailPath(landingPageId: string): string {
  return buildGrowthPersonalizedVideosPageDetailPath(landingPageId)
}

export function buildSendrVideoReturnQuery(ctx: SendrVideoReturnContext): URLSearchParams {
  const params = new URLSearchParams({
    [SENDR_VIDEO_RETURN_QUERY.returnTo]: ctx.returnTo,
    [SENDR_VIDEO_RETURN_QUERY.landingPageId]: ctx.landingPageId,
  })
  if (ctx.sectionId) {
    params.set(SENDR_VIDEO_RETURN_QUERY.sectionId, ctx.sectionId)
  }
  return params
}

export function parseSendrVideoReturnContext(
  searchParams: URLSearchParams | Record<string, string | null | undefined>,
): SendrVideoReturnContext | null {
  const read = (key: string): string | null => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key)
    }
    const value = searchParams[key]
    return typeof value === "string" ? value : null
  }

  const returnTo = read(SENDR_VIDEO_RETURN_QUERY.returnTo)?.trim() ?? null
  const landingPageId = read(SENDR_VIDEO_RETURN_QUERY.landingPageId)?.trim() ?? null
  if (!returnTo || !landingPageId) return null
  if (!isSafeSendrReturnPath(returnTo)) return null
  if (!isSendrUuid(landingPageId)) return null

  const sectionId = read(SENDR_VIDEO_RETURN_QUERY.sectionId)?.trim() ?? undefined
  if (sectionId && !isSendrUuid(sectionId)) return null

  return {
    returnTo,
    landingPageId,
    ...(sectionId ? { sectionId } : {}),
  }
}

export function buildSendrVideoReturnContextForPage(input: {
  landingPageId: string
  sectionId?: string | null
}): SendrVideoReturnContext {
  return {
    returnTo: buildSendrPageDetailPath(input.landingPageId),
    landingPageId: input.landingPageId,
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
  }
}

export function buildGrowthVideoRecordHref(ctx: SendrVideoReturnContext): string {
  return `/growth/videos/record?${buildSendrVideoReturnQuery(ctx).toString()}`
}

export function buildGrowthVideoLibraryHref(
  ctx: SendrVideoReturnContext,
  options?: { openUpload?: boolean },
): string {
  const params = buildSendrVideoReturnQuery(ctx)
  if (options?.openUpload) {
    params.set(SENDR_VIDEO_RETURN_QUERY.upload, "1")
  }
  return `/growth/videos/library?${params.toString()}`
}

export function buildSendrReturnWithAssetPath(
  ctx: SendrVideoReturnContext,
  assetId: string,
): string {
  const params = new URLSearchParams({
    [SENDR_VIDEO_RETURN_QUERY.landingPageId]: ctx.landingPageId,
    [SENDR_VIDEO_RETURN_QUERY.assetId]: assetId,
    [SENDR_VIDEO_RETURN_QUERY.attachPending]: "1",
  })
  if (ctx.sectionId) {
    params.set(SENDR_VIDEO_RETURN_QUERY.sectionId, ctx.sectionId)
  }
  return `${ctx.returnTo}?${params.toString()}`
}

export function parseSendrReturnAttachParams(
  searchParams: URLSearchParams | Record<string, string | null | undefined>,
): {
  landingPageId: string
  assetId: string
  sectionId?: string
} | null {
  const read = (key: string): string | null => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key)
    }
    const value = searchParams[key]
    return typeof value === "string" ? value : null
  }

  if (read(SENDR_VIDEO_RETURN_QUERY.attachPending) !== "1") return null

  const landingPageId = read(SENDR_VIDEO_RETURN_QUERY.landingPageId)?.trim() ?? null
  const assetId = read(SENDR_VIDEO_RETURN_QUERY.assetId)?.trim() ?? null
  if (!isSendrUuid(landingPageId) || !isSendrUuid(assetId)) return null

  const sectionId = read(SENDR_VIDEO_RETURN_QUERY.sectionId)?.trim() ?? undefined
  if (sectionId && !isSendrUuid(sectionId)) return null

  return {
    landingPageId,
    assetId,
    ...(sectionId ? { sectionId } : {}),
  }
}
