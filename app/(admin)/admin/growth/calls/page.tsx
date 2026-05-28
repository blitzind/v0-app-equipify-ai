import { redirect } from "next/navigation"
import { GROWTH_CALLS_PRIMARY_HREF } from "@/lib/growth/navigation/growth-workspace-consolidation"

/** Legacy Call Copilot dashboard route — unified under Calls workspace. */
export default function AdminGrowthCallsRedirectPage() {
  redirect(GROWTH_CALLS_PRIMARY_HREF)
}
