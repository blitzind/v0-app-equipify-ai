import { redirect } from "next/navigation"
import { GROWTH_REVENUE_QUEUE_HREF } from "@/lib/growth/navigation/growth-navigation-destinations"

type LegacyGrowthLeadsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy alias — preserves bookmarks and deep links to `/admin/growth/leads`. */
export default async function LegacyGrowthLeadsRedirect({ searchParams }: LegacyGrowthLeadsPageProps) {
  const params = await searchParams
  const qs = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value)
    else if (Array.isArray(value)) {
      for (const entry of value) qs.append(key, entry)
    }
  }

  const query = qs.toString()
  redirect(query ? `${GROWTH_REVENUE_QUEUE_HREF}?${query}` : GROWTH_REVENUE_QUEUE_HREF)
}
