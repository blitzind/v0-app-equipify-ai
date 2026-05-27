"use client"

import { Button } from "@/components/ui/button"
import { LEAD_INTELLIGENCE_INSPECTOR_FIXTURES } from "@/lib/growth/lead-engine/lead-intelligence-inspector-fixtures"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"
import { cn } from "@/lib/utils"

export function LeadIntelligenceExamplePresets({
  activeId,
  onSelect,
  className,
}: {
  activeId?: string | null
  onSelect: (input: GrowthLeadEngineSandboxInput, id: string) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)} data-qa-marker="lead-intelligence-example-presets">
      <p className="text-xs font-medium text-muted-foreground">Example accounts</p>
      <div className="flex flex-wrap gap-2">
        {LEAD_INTELLIGENCE_INSPECTOR_FIXTURES.map((fixture) => (
          <Button
            key={fixture.id}
            type="button"
            size="sm"
            variant={activeId === fixture.id ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => onSelect(fixture.input, fixture.id)}
          >
            {fixture.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
