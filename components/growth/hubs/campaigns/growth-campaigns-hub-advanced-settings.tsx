"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthMultichannelDashboardView } from "@/components/growth/growth-multichannel-dashboard"
import { cn } from "@/lib/utils"

export function GrowthCampaignsHubAdvancedSettings() {
  const [open, setOpen] = useState(false)

  return (
    <section aria-labelledby="campaigns-hub-advanced-settings-heading" data-section="advanced-settings">
      <div className="rounded-xl border border-border/80 bg-muted/10">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="campaigns-hub-advanced-settings-heading" className="text-base font-semibold text-foreground">
              Advanced Settings
            </h2>
            <p className="text-sm text-muted-foreground">
              Routing rules, future channels, execution configuration, and orchestration controls.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-controls="campaigns-hub-advanced-settings-panel"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown className="mr-1.5 size-4" aria-hidden /> : <ChevronRight className="mr-1.5 size-4" aria-hidden />}
            {open ? "Hide" : "Show"}
          </Button>
        </div>
        <div
          id="campaigns-hub-advanced-settings-panel"
          className={cn("border-t border-border/80 px-4 pb-4", !open && "hidden")}
          hidden={!open}
        >
          <GrowthEngineCard title="Orchestration Configuration" className="mt-4 border-0 shadow-none">
            <GrowthMultichannelDashboardView advancedSettingsMode />
          </GrowthEngineCard>
        </div>
      </div>
    </section>
  )
}
