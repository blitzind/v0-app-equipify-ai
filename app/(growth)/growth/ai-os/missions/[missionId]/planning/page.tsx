import { redirect, RedirectType } from "next/navigation"
import { mapAiOsLegacyPublicPathToCanonical } from "@/lib/growth/aios/ai-os-public-routes"

type PageProps = {
  params: Promise<{ missionId: string }>
}

export default async function GrowthAiOsLegacyMissionPlanningRedirectPage({ params }: PageProps) {
  const { missionId } = await params
  const target =
    mapAiOsLegacyPublicPathToCanonical(`/growth/ai-os/missions/${missionId}/planning`) ??
    "/growth/os/missions"
  redirect(target, RedirectType.permanent)
}
