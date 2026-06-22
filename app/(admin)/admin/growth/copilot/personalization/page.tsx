import { redirect } from "next/navigation"
import { GROWTH_PERSONALIZATION_WORKSPACE_PATH } from "@/lib/growth/personalization/personalization-generation-ux"

type LegacyPersonalizationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy alias — preserves bookmarks and deep links to `/admin/growth/copilot/personalization`. */
export default async function LegacyGrowthPersonalizationRedirect({
  searchParams,
}: LegacyPersonalizationPageProps) {
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
  redirect(query ? `${GROWTH_PERSONALIZATION_WORKSPACE_PATH}?${query}` : GROWTH_PERSONALIZATION_WORKSPACE_PATH)
}
