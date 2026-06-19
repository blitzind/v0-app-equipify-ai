"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GROWTH_INBOX_HUB_ADVANCED_TOOLS } from "@/lib/growth/hubs/growth-inbox-hub-config"
import { cn } from "@/lib/utils"

export function GrowthInboxAdvancedTools() {
  const [open, setOpen] = useState(false)

  return (
    <section aria-labelledby="inbox-hub-advanced-tools-heading" data-section="advanced-tools">
      <div className="rounded-xl border border-border/80 bg-muted/10">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="inbox-hub-advanced-tools-heading" className="text-base font-semibold text-foreground">
              Advanced Tools
            </h2>
            <p className="text-sm text-muted-foreground">
              Workflow, approvals, diagnostics, and channel operations.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-controls="inbox-hub-advanced-tools-panel"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown className="mr-1.5 size-4" aria-hidden /> : <ChevronRight className="mr-1.5 size-4" aria-hidden />}
            {open ? "Hide" : "Show"}
          </Button>
        </div>
        <div
          id="inbox-hub-advanced-tools-panel"
          className={cn("border-t border-border/80 px-4 pb-4", !open && "hidden")}
          hidden={!open}
        >
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {GROWTH_INBOX_HUB_ADVANCED_TOOLS.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={tool.href}
                  className="block rounded-lg border border-border/70 bg-background px-3 py-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <p className="font-medium text-foreground">{tool.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
