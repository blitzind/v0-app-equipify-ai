import { redirect, RedirectType } from "next/navigation"
import { mapAiOsLegacyPublicPathToCanonical } from "@/lib/growth/aios/ai-os-public-routes"

type PageProps = {
  params: Promise<{ leadId: string }>
}

export default async function GrowthAiOsLegacyLeadResearchPilotRedirectPage({ params }: PageProps) {
  const { leadId } = await params
  const target =
    mapAiOsLegacyPublicPathToCanonical(`/growth/ai-os/pilot/lead-research/${leadId}`) ??
    "/growth/os/pilot/lead-research"
  redirect(target, RedirectType.permanent)
}
