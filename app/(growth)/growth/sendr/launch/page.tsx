import { redirect } from "next/navigation"
import { buildGrowthPersonalizedVideosWorkspaceHref } from "@/lib/growth/sendr/growth-sendr-branding"

type LegacySendrLaunchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy alias — preserves bookmarks and deep links to `/growth/sendr/launch`. */
export default async function LegacyGrowthSendrLaunchRedirect({ searchParams }: LegacySendrLaunchPageProps) {
  const params = await searchParams
  const target = buildGrowthPersonalizedVideosWorkspaceHref("launch")
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
  redirect(query ? `${target}?${query}` : target)
}
