import { redirect } from "next/navigation"
import { buildGrowthLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

type PageProps = { params: Promise<{ leadId: string }> }

/** Legacy lead detail path — canonical operator surface is CRM drawer (`?open=`). */
export default async function GrowthLeadDetailRedirectPage({ params }: PageProps) {
  const { leadId } = await params
  redirect(buildGrowthLeadHref(leadId))
}
