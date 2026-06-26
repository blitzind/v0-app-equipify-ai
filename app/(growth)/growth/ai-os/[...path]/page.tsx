import { redirect, RedirectType } from "next/navigation"
import { mapAiOsLegacyPublicPathToCanonical } from "@/lib/growth/aios/ai-os-public-routes"

type PageProps = {
  params: Promise<{ path: string[] }>
}

export default async function GrowthAiOsLegacyCatchAllRedirectPage({ params }: PageProps) {
  const { path } = await params
  const legacyPath = `/growth/ai-os/${path.join("/")}`
  const target = mapAiOsLegacyPublicPathToCanonical(legacyPath) ?? "/growth/os"
  redirect(target, RedirectType.permanent)
}
