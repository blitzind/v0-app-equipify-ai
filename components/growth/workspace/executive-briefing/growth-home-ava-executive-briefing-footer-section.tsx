"use client"

import { Trophy, ArrowRight } from "lucide-react"

type Props = {
  recentWins: string[]
  whatsNext: string[]
}

export function GrowthHomeAvaExecutiveBriefingFooterSection({ recentWins, whatsNext }: Props) {
  if (recentWins.length === 0 && whatsNext.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2" data-qa-section="home-ava-executive-briefing-footer">
      {recentWins.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border/50 bg-card/60 p-3" data-qa-field="executive-recent-wins">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Trophy className="size-4 text-amber-600 dark:text-amber-300" aria-hidden />
            Recent wins
          </div>
          <ul className="space-y-1.5 text-sm text-foreground">
            {recentWins.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {whatsNext.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border/50 bg-card/60 p-3" data-qa-field="executive-whats-next">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ArrowRight className="size-4 text-indigo-600 dark:text-indigo-300" aria-hidden />
            What&apos;s next
          </div>
          <ul className="space-y-1.5 text-sm text-foreground">
            {whatsNext.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
