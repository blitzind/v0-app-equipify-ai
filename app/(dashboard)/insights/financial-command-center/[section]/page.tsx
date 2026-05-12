"use client"

import { Suspense } from "react"
import { notFound, useParams } from "next/navigation"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { BLITZPAY_FCC_SLUG_SET } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import { BlitzpayDynamicSection } from "../blitzpay-dynamic-section"

function SectionFallback() {
  return (
    <div
      className="rounded-xl border border-border bg-muted/15 p-8 min-h-[200px] animate-pulse"
      aria-hidden
    />
  )
}

export default function FinancialCommandCenterSectionPage() {
  const params = useParams()
  const raw = params.section
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : ""

  if (!slug || !BLITZPAY_FCC_SLUG_SET.has(slug)) {
    notFound()
  }

  const { organizationId, status: orgStatus } = useActiveOrganization()
  const orgReady = orgStatus === "ready"

  return (
    <Suspense fallback={<SectionFallback />}>
      <div className="flex flex-col gap-5 min-w-0">
        <BlitzpayDynamicSection slug={slug} organizationId={organizationId} orgReady={orgReady} />
      </div>
    </Suspense>
  )
}
