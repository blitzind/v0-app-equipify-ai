"use client"

import type { ReactNode } from "react"

type Props = {
  title: string
  description?: string | null
  children: ReactNode
  qaSection: string
}

export function GrowthTrainingSectionCard({ title, description, children, qaSection }: Props) {
  return (
    <section
      data-qa-section={qaSection}
      className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
