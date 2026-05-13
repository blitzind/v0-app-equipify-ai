import { notFound } from "next/navigation"
import { BLITZPAY_FCC_SLUG_SET } from "@/lib/navigation/blitzpay-financial-command-center-nav"

/**
 * Validates the `[section]` segment. Section UI mounts in `BlitzpayFccSectionHost` (layout)
 * so panels stay cached when switching routes.
 */
export default async function FinancialCommandCenterSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!BLITZPAY_FCC_SLUG_SET.has(section)) {
    notFound()
  }
  return null
}
