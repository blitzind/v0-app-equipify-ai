import { redirect } from "next/navigation"
import { GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH } from "@/lib/growth/sendr/growth-sendr-branding"

export const runtime = "nodejs"

function buildLegacyPublicRedirectPath(
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value)
    else if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry)
    }
  }
  const query = params.toString()
  const base = `${GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH}/${slug}`
  return query ? `${base}?${query}` : base
}

/** Legacy `/sendr/[slug]` compatibility — redirects to canonical `/videos/[slug]`. */
export default async function SendrLegacyPublicPageRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const query = await searchParams
  redirect(buildLegacyPublicRedirectPath(slug, query))
}
