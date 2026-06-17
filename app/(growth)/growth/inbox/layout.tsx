import type { ReactNode } from "react"
import { GrowthInboxShell } from "@/components/growth/inbox/growth-inbox-shell"

export default function GrowthInboxLayout({ children }: { children: ReactNode }) {
  return <GrowthInboxShell>{children}</GrowthInboxShell>
}
