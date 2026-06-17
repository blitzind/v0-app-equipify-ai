"use client"

import { GrowthInboxShell } from "@/components/growth/inbox/growth-inbox-shell"
import type { ReactNode } from "react"

type GrowthInboxLayoutProps = {
  children: ReactNode
}

export default function GrowthInboxLayout({ children }: GrowthInboxLayoutProps) {
  return <GrowthInboxShell>{children}</GrowthInboxShell>
}
