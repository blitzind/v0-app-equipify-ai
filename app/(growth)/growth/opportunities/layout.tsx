import type { ReactNode } from "react"
import { GrowthOpportunitiesShell } from "@/components/growth/opportunities/growth-opportunities-shell"

export default function GrowthOpportunitiesLayout({ children }: { children: ReactNode }) {
  return <GrowthOpportunitiesShell>{children}</GrowthOpportunitiesShell>
}
