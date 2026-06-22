import { redirect } from "next/navigation"
import { GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH } from "@/lib/growth/sendr/growth-sendr-branding"

type LegacySendrActivityPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy alias — preserves bookmarks and deep links to `/growth/sendr/activity`. */
export default async function LegacyGrowthSendrActivityRedirect({ searchParams }: LegacySendrActivityPageProps) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim())
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) qs.append(key, entry.trim())
      }
    }
  }
  const query = qs.toString()
  redirect(query ? `${GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH}?${query}` : GROWTH_PERSONALIZED_VIDEOS_ACTIVITY_PATH)
}
