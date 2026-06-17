import type { ReactNode } from "react"
import { Suspense } from "react"
import { GrowthOpportunitiesDefaultTabSync } from "@/components/growth/opportunities/growth-opportunities-default-tab-sync"
import { GrowthOpportunitiesShell } from "@/components/growth/opportunities/growth-opportunities-shell"

export default function GrowthOpportunitiesLayout({ children }: { children: ReactNode }) {
  return (
    <GrowthOpportunitiesShell>
      <Suspense fallback={null}>
        <GrowthOpportunitiesDefaultTabSync />
      </Suspense>
      {children}
    </GrowthOpportunitiesShell>
  )
}
