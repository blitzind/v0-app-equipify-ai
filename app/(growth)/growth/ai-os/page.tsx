import { redirect, RedirectType } from "next/navigation"
import { GROWTH_AI_OS_PUBLIC_BASE_PATH } from "@/lib/growth/aios/ai-os-public-routes"

export default function GrowthAiOsLegacyIndexRedirectPage() {
  redirect(GROWTH_AI_OS_PUBLIC_BASE_PATH, RedirectType.permanent)
}
