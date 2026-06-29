"use client"

import type { GrowthHomeAvaLiveStatus } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export function GrowthHomeAvaLiveStatusSection({ status }: { status: GrowthHomeAvaLiveStatus | null }) {
  if (!status || status.items.length === 0) return null

  return (
    <section
      data-qa-section="home-ava-live-status"
      className="rounded-2xl border border-border/70 bg-card p-5 space-y-4"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">What I&apos;m doing right now</h2>
        <p className="mt-1 text-sm text-muted-foreground">Live runtime status from today&apos;s work.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {status.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm text-muted-foreground">{item.verb}</p>
            <p className="mt-1 text-base font-medium text-foreground">{item.label}</p>
            {item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}
          </div>
        ))}
      </div>
      {status.learningLabel ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Learning:</span> {status.learningLabel}
        </p>
      ) : null}
      {status.runtimeNote ? <p className="text-sm text-muted-foreground">{status.runtimeNote}</p> : null}
    </section>
  )
}
