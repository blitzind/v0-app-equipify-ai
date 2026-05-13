"use client"

import Link from "next/link"
import { Lightbulb, Sparkles, LayoutGrid } from "lucide-react"
import type { UseFirstRunReturn } from "@/hooks/use-first-run"
import { sendOnboardingProductEvent } from "@/hooks/use-onboarding-product-event"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Industry-aware demo hints, quick links, and recommended modules.
 */
export function IndustryDemoStarterPanel({
  firstRun,
  className,
}: {
  firstRun: UseFirstRunReturn
  className?: string
}) {
  const { organizationId } = useActiveOrganization()
  const { data, loading } = firstRun
  if (loading && !data) return null
  if (!data) return null

  const hints = data.demoWalkthroughHints ?? []
  const actions = data.quickActions ?? []
  const modules = (data.recommendedModules ?? []).filter((m) => m.applicable)

  const show =
    data.hasSampleWorkspace || hints.length > 0 || actions.length > 0 || modules.length > 0
  if (!show) return null

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden print:hidden",
        className,
      )}
      aria-labelledby="industry-demo-starter-heading"
    >
      <div className="flex items-start gap-2 px-4 py-3 border-b border-border bg-muted/25">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <h2 id="industry-demo-starter-heading" className="text-sm font-semibold text-foreground">
            {data.hasSampleWorkspace ? "Try your demo workspace" : "Recommended next steps"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Shortcuts tuned for{" "}
            <span className="text-foreground font-medium">{data.industryLabel}</span>
            {data.hasSampleWorkspace ? " — explore sample data before you go live." : "."}
          </p>
        </div>
      </div>

      <div className="px-4 py-3 grid gap-4 lg:grid-cols-3">
        {modules.length > 0 ? (
          <div className="min-w-0 lg:col-span-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden />
              Recommended modules
            </p>
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <Button key={m.moduleKey} variant="secondary" size="sm" className="h-8 text-xs max-w-full" asChild>
                  <Link
                    href={m.href}
                    title={m.blurb}
                    onClick={() => {
                      if (organizationId) {
                        sendOnboardingProductEvent(
                          organizationId,
                          "onboarding_demo_panel_clicked",
                          m.moduleKey,
                        )
                      }
                    }}
                  >
                    {m.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {hints.length > 0 ? (
          <div className="min-w-0 lg:col-span-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden />
              Walkthrough ideas
            </p>
            <ul className="space-y-2">
              {hints.map((h, i) => (
                <li key={i} className="text-sm text-foreground leading-snug">
                  {h.href ?
                    <Link
                      href={h.href}
                      className="font-medium text-primary hover:underline underline-offset-2"
                      onClick={() => {
                        if (organizationId) {
                          sendOnboardingProductEvent(organizationId, "onboarding_demo_panel_clicked", "hint_link")
                        }
                      }}
                    >
                      {h.text}
                    </Link>
                  : <span>{h.text}</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {actions.length > 0 ? (
          <div className="flex flex-col gap-2 min-w-0 lg:col-span-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button key={a.href + a.label} variant="secondary" size="sm" className="h-8 text-xs" asChild>
                  <Link
                    href={a.href}
                    onClick={() => {
                      if (organizationId) {
                        sendOnboardingProductEvent(organizationId, "onboarding_demo_panel_clicked", "quick_action")
                      }
                    }}
                  >
                    {a.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
