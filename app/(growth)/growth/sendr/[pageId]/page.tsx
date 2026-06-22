import { redirect } from "next/navigation"
import { buildGrowthPersonalizedVideosPageDetailPath } from "@/lib/growth/sendr/growth-sendr-branding"

type LegacySendrPageDetailProps = {
  params: Promise<{ pageId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy alias — preserves bookmarks and deep links to `/growth/sendr/[pageId]`. */
export default async function LegacyGrowthSendrPageDetailRedirect({
  params,
  searchParams,
}: LegacySendrPageDetailProps) {
  const { pageId } = await params
  const target = buildGrowthPersonalizedVideosPageDetailPath(pageId)
  const resolvedParams = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim())
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) qs.append(key, entry.trim())
      }
    }
  }
  const query = qs.toString()
  redirect(query ? `${target}?${query}` : target)
}
